import TonConnect, { TonConnectOptions, Wallet, WalletConnectionSource } from "@tonconnect/sdk";
import { Locale, Locales, Styles } from "./protocol";
import { DropdownMenu, DropdownMenuItem } from "./dropdown";
import { buttonDesign, locales, DARK_COPY, DARK_DIAMOND, DARK_DISCONNECT, LIGHT_COPY, LIGHT_DIAMOND, LIGHT_DISCONNECT } from "./consts"
import { hexToNumber, rawAddressToFriendly, smoothScale } from "./utils";
import { getConnector } from "./connect";
import { redirectToTelegram } from "./tma-web-api";
import { loadIcons } from "./icons";

let connectedWallet: Wallet | null = null;
export function getConnectedWallet(): Wallet | null {
    return connectedWallet;
}

export function restoreWalletConnection(options?: TonConnectOptions) {
    return new Promise<Wallet | null>((resolve, reject) => {
        const connector = getConnector(options);
        connector.restoreConnection().then(() => {
            connectedWallet = connector.wallet;
            resolve(connectedWallet);
        }).catch((error) => {
            reject(error);
        });
    });
}

export interface ConnectTelegramWalletParams {
    style: Styles;
    onWalletChange?: (wallet: Wallet | null) => void;
    onError: (error: Error | unknown) => void;
    language?: Locales;
    tonParams?: TonConnectOptions;
}

export class ConnectTelegramWalletButton extends Phaser.GameObjects.Container {
    buttonContainer: Phaser.GameObjects.Container;
    buttonBackground: Phaser.GameObjects.Graphics;
    buttonText: Phaser.GameObjects.Text;
    buttonIcon?: Phaser.GameObjects.Image;
    buttonWidth: number;
    buttonHeight: number;
    wallet: Wallet | null = null;
    params: ConnectTelegramWalletParams;
    connectionSource: WalletConnectionSource;
    connector: TonConnect;
    unsubscribeFromConnector: () => void;
    dropdownMenu?: DropdownMenu;
    locale: Locale;
    currentIcon: string;
    changeIconTimer: NodeJS.Timeout | number | null = null;

    constructor(
        scene: Phaser.Scene,
        x: number = 0,
        y: number = 0,
        params: ConnectTelegramWalletParams
    ) {
        super(scene, x, y);
        this.params = params;
        // this.connectionSource = {jsBridgeKey: 'tonkeeper'};
        this.connectionSource = {
            bridgeUrl: 'https://bridge.tonapi.io/bridge',
            universalLink: 'https://t.me/wallet?attach=wallet'
        }
        this.connector = getConnector(params.tonParams);
        this.loadAssets(scene);

        const locale = locales[params.language ?? 'en'];
        this.locale = locale;
        const styleSchema = params.style === 'dark' ? buttonDesign.dark : buttonDesign.light;
        const backgroundColor = params.style === 'dark'
            ? hexToNumber(styleSchema.backgroundColor) : hexToNumber(styleSchema.backgroundColor);

        const btnCtr = new Phaser.GameObjects.Container(scene, 0, 0);

        const textObject = scene.add.text(
            // 0,
            // 0,
            buttonDesign.horizontalPadding + buttonDesign.icon.width,
            buttonDesign.verticalPadding,
            locale.connectWallet,
            {
                color: styleSchema.fontColor,
                fontFamily: buttonDesign.fontFamily,
                fontSize: buttonDesign.fontSize,
            }
        );
        this.buttonText = textObject;

        const textWidth = textObject.width;
        const textHeight = textObject.height;
        const buttonWidth = textWidth + (buttonDesign.horizontalPadding * 2) + buttonDesign.icon.width + buttonDesign.icon.horizontalPadding;
        const buttonHeight = textHeight + (buttonDesign.verticalPadding * 2);

        this.buttonWidth = buttonWidth;
        this.buttonHeight = buttonHeight;

        this.currentIcon = styleSchema.icons.diamond;

        const button = scene.add.graphics({
            x: 0,
            y: 0,
            fillStyle: { color: this.wallet == null ? hexToNumber(styleSchema.backgroundColor) : backgroundColor },
            lineStyle: { width: buttonDesign.borderWidth, color: hexToNumber(styleSchema.borderColor) }
        });
        button.fillRoundedRect(0, 0, buttonWidth, buttonHeight, buttonDesign.borderRadius);
        button.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, buttonDesign.borderRadius);
        this.buttonBackground = button;
        // button.setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

        btnCtr.on('pointerover', () => {
            scene.game.canvas.style.cursor = 'pointer';
            if (this.wallet !== null) {
                this.repaintButtonBackground(styleSchema.backgroundColorHover, styleSchema.borderColor);
            }
            smoothScale(scene.tweens, btnCtr, 1.02, 125);
        });
        btnCtr.on('pointerout', () => {
            scene.game.canvas.style.cursor = 'default';
            if (this.wallet !== null) {
                this.repaintButtonBackground(styleSchema.backgroundColor, styleSchema.borderColor);
            }
            smoothScale(scene.tweens, btnCtr, 1, 125);
        });
        btnCtr.on('pointerdown', () => {
            smoothScale(scene.tweens, btnCtr, 0.98, 125);
        });
        btnCtr.on('pointerup', () => {
            smoothScale(scene.tweens, btnCtr, 1.02, 125);
        });

        this.buttonContainer = btnCtr;


        textObject.setText('...');

        this.unsubscribeFromConnector = this.connector.onStatusChange((wallet) => {
            connectedWallet = wallet;
            this.wallet = wallet;

            btnCtr.off('pointerdown', this.connectWallet);
            btnCtr.off('pointerdown', this.toggleDropdownMenu);

            if (wallet) {
                textObject
                    .setText(rawAddressToFriendly(wallet.account.address, true));
                btnCtr
                    .on('pointerdown', this.toggleDropdownMenu);

                // todo handle style change outside
                this.setSchema(styleSchema);
            } else {
                textObject
                    .setText(locale.connectWallet);
                btnCtr
                    .on('pointerdown', this.connectWallet);

                this.setSchema(buttonDesign.default);
            }

            if (this.params.onWalletChange) {
                this.params.onWalletChange(wallet);
            }
        });

        this.connector.restoreConnection().then(() => {
            if (this.wallet === null) {
                textObject
                    .setText(locale.connectWallet);
                btnCtr.on('pointerdown', this.connectWallet);
                this.setSchema(buttonDesign.default);
            }

            this.enable();
        });

        this.setSize(this.buttonWidth, this.buttonHeight);
    }

    private loadAssets(scene: Phaser.Scene) {
        loadIcons(scene.textures).then(() => {
            const icon = scene.add.image(
                buttonDesign.horizontalPadding - buttonDesign.icon.horizontalPadding + buttonDesign.icon.width * 0.5,
                this.buttonHeight * 0.5,
                this.currentIcon
            );
            this.buttonIcon = icon;

            this.dropdownMenu = new DropdownMenu(
                scene,
                0,
                this.buttonHeight + buttonDesign.dropDown.topMargin,
                {
                    style: this.params.style,
                    items: [
                        {
                            icon: this.params.style === 'dark' ? DARK_COPY : LIGHT_COPY,
                            text: this.locale.copyAddress,
                            onClick: this.copyAddress,
                        },
                        {
                            icon: this.params.style === 'dark' ? DARK_DISCONNECT : LIGHT_DISCONNECT,
                            text: this.locale.disconnectWallet,
                            onClick: () => {
                                this.toggleDropdownMenu();
                                this.disconnectWallet();
                            }
                        },
                    ]
                }
            );
            this.dropdownMenu.setVisible(false);

            this.buttonContainer.add([this.buttonBackground, this.buttonIcon, this.buttonText]);
            this.add([this.buttonContainer, this.dropdownMenu]);
            scene.add.existing(this);
        });
    }

    private changeIcon(icon: string) {
        this.cancelIconChange();

        if (this.buttonIcon) {
            this.currentIcon = icon;
            this.buttonIcon.setTexture(icon);
        } else {
            this.changeIconTimer = setTimeout(() => {
                this.changeIcon(icon);
            }, 4);
        }
    }

    private cancelIconChange() {
        if (this.changeIconTimer !== null) {
            clearTimeout(this.changeIconTimer);
            this.changeIconTimer = null;
        }
    }

    private connectWallet = () => {
        try {
            // todo disable button while waiting for the connection, now not working
            this.disable();
            const connectUrl = this.connector.connect(this.connectionSource);
            if (connectUrl) {
                redirectToTelegram(connectUrl, {
                    returnStrategy: 'back',
                    twaReturnUrl: 'https://t.me/flappybirddevbot/flappybirddev',
                    forceRedirect: false
                });
            }
        } catch (error) {
            this.params.onError(error);
        } finally {
            this.enable();
        }
    }

    private disconnectWallet = async () => {
        try {
            this.disable();
            await this.connector.disconnect();
        } catch (error) {
            this.params.onError(error);
        } finally {
            this.enable();
        }
    }

    private copyAddress = async (item: DropdownMenuItem) => {
        if (this.wallet == null) {
            return;
        }

        try {
            await navigator.clipboard.writeText(rawAddressToFriendly(this.wallet.account.address));
            const oldText = item.text.text;
            item.text.setText(this.locale.addressCopied);
            setTimeout(() => {
                try {
                    item.text.setText(oldText);
                    // this.toggleDropdownMenu();
                } catch(error) {
                    // ignore in case the object was destroyed by leaving the scene
                }
            }, 500);
        } catch (error) {
            this.params.onError(error);
        }
    }

    private disable() {
        this.buttonContainer.setInteractive(false);
    }

    private enable() {
        this.buttonContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.buttonWidth, this.buttonHeight), Phaser.Geom.Rectangle.Contains);
    }

    private toggleDropdownMenu = () => {
        if (this.dropdownMenu == null) {
            return;
        }

        this.dropdownMenu.setVisible(!this.dropdownMenu.visible);
    }

    private setSchema(schema: typeof buttonDesign.dark) {
        this.repaintButtonBackground(schema.backgroundColor, schema.borderColor);
        this.changeIcon(schema.icons.diamond);
        this.buttonText.setColor(schema.fontColor);
    }

    private repaintButtonBackground(backgroundColor: string, borderColor: string) {
        this.buttonBackground.clear();
        this.buttonBackground.fillStyle(hexToNumber(backgroundColor));
        this.buttonBackground.lineStyle(buttonDesign.borderWidth, hexToNumber(borderColor));
        this.buttonBackground.fillRoundedRect(0, 0, this.buttonWidth, this.buttonHeight, buttonDesign.borderRadius);
        this.buttonBackground.strokeRoundedRect(0, 0, this.buttonWidth, this.buttonHeight, buttonDesign.borderRadius);
    }

    public destroy() {
        this.unsubscribeFromConnector();
        this.cancelIconChange();
        // todo Will the super destroy() call remove all listeners?
        /* this.buttonContainer.removeAllListeners();
        this.buttonContainer.destroy(); */
        super.destroy();
    }
}
