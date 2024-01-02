import { getHttpV4Endpoint } from "@orbs-network/ton-access";
import { Address, TonClient4, beginCell, toNano } from "@ton/ton";
import { BALANCE_RELOAD_INTERVAL, PIPES_AVAILABLE, PIPES_COSTS, SHOP_RELOAD_INTERVAL } from "./consts";
import { ITonConnect } from "@tonconnect/ui";
import { Config } from "./config";

export class UI {
    scoreDiv: HTMLDivElement = document.getElementById('score') as HTMLDivElement;
    rewardsDiv: HTMLDivElement = document.getElementById('rewards') as HTMLDivElement;
    spinnerDiv: HTMLDivElement = document.getElementById('spinner-container') as HTMLDivElement;
    skinChooserDiv: HTMLDivElement = document.getElementById('skin-chooser') as HTMLDivElement;
    skinPrevDiv: HTMLDivElement = document.getElementById('skin-prev') as HTMLDivElement;
    skinCurrentDiv: HTMLDivElement = document.getElementById('skin-current') as HTMLDivElement;
    skinImage: HTMLImageElement = document.getElementById('skin-image') as HTMLImageElement;
    skinNextDiv: HTMLDivElement = document.getElementById('skin-next') as HTMLDivElement;
    useButton: HTMLButtonElement = document.getElementById('use') as HTMLButtonElement;
    shopButton: HTMLButtonElement = document.getElementById('shop') as HTMLButtonElement;
    playButton: HTMLButtonElement = document.getElementById('play') as HTMLButtonElement;
    buttonsDiv: HTMLDivElement = document.getElementById('buttons') as HTMLDivElement;
    balanceDiv: HTMLDivElement = document.getElementById('balance') as HTMLDivElement;
    playTextDiv: HTMLDivElement = document.getElementById('play-text') as HTMLDivElement;
    useTextDiv: HTMLDivElement = document.getElementById('use-text') as HTMLDivElement;
    balanceContainerDiv: HTMLDivElement = document.getElementById('balance-container') as HTMLDivElement;
    afterGameDiv: HTMLDivElement = document.getElementById('after-game') as HTMLDivElement;
    errorDiv: HTMLDivElement = document.getElementById('error') as HTMLDivElement;
    tokensAwardedDiv: HTMLDivElement = document.getElementById('tokens-awarded') as HTMLDivElement;
    newAchievementsDiv: HTMLDivElement = document.getElementById('new-achievements') as HTMLDivElement;

    currentPipeIndex = Number(window.localStorage.getItem('chosen-pipe') ?? '0');
    previewPipeIndex = this.currentPipeIndex;

    shopShown = false;

    purchases: { systemName: string }[] = [];

    reloadShopTimeout: any = undefined;

    client: TonClient4 | undefined = undefined;
    jettonWallet: Address | undefined = undefined;
    balanceTimer: NodeJS.Timeout | number | null = null;

    constructor(public readonly config: Config, public readonly tc: ITonConnect) {
        this.skinPrevDiv.addEventListener('click', () => {
            this.previewPipeIndex--;
            this.redrawShop();
        });
        this.skinNextDiv.addEventListener('click', () => {
            this.previewPipeIndex++;
            this.redrawShop();
        });
        this.useButton.addEventListener('click', () => {
            if (this.previewPipeIndex !== 0 && this.purchases.findIndex(p => p.systemName === this.getPreviewPipe()) === -1) {
                this.buy(this.previewPipeIndex);
                return;
            }
            this.currentPipeIndex = this.previewPipeIndex;
            window.localStorage.setItem('chosen-pipe', this.currentPipeIndex.toString());
            this.redrawShop();
        });
        this.shopButton.addEventListener('click', () => {
            if (this.shopShown) this.hideShop();
            else this.showShop();
        });
    }

    showBalance() {
        this.balanceContainerDiv.style.display = 'block';

        this.updateBalance();
    }

    async updateBalance() {
        const bal = await this.getBalance();
        this.balanceDiv.innerText = bal.toString();
        this.balanceTimer = setTimeout(() => this.showBalance(), BALANCE_RELOAD_INTERVAL);
    }

    hideBalance() {
        if (this.balanceTimer !== null) {
            clearTimeout(this.balanceTimer);
        }
        this.balanceContainerDiv.style.display = 'none';
    }

    async getBalance() {
        try {
            const client = await this.getClient();
            const jw = await this.getJettonWallet();
            const last = await client.getLastBlock();
            const r = await client.runMethod(last.last.seqno, jw, 'get_wallet_data');
            return r.reader.readBigNumber();
        } catch (e) {
            console.error('failed to load balance', e);
            return BigInt(0);
        }
    }

    async getJettonWallet() {
        if (this.jettonWallet === undefined) {
            const client = await this.getClient();
            if (this.tc.account === null) {
                throw new Error('No account');
            }
            const lastBlock = await client.getLastBlock();
            const r = await client.runMethod(lastBlock.last.seqno, Address.parse(this.config.TOKEN_MASTER), 'get_wallet_address', [{
                type: 'slice',
                cell: beginCell().storeAddress(Address.parse(this.tc.account.address)).endCell(),
            }]);
            const addrItem = r.result[0];
            if (addrItem.type !== 'slice') throw new Error('Bad type');
            this.jettonWallet = addrItem.cell.beginParse().loadAddress();
        }
        return this.jettonWallet;
    }

    async getClient() {
        if (this.client === undefined) {
            this.client = new TonClient4({
                endpoint: await getHttpV4Endpoint({ network: this.config.NETWORK }),
            });
        }
        return this.client;
    }

    async buy(itemId: number) {
        const price = PIPES_COSTS[this.previewPipeIndex];
        await this.tc.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 3600,
            messages: [
                {
                    address: (await this.getJettonWallet()).toString(),
                    amount: toNano(0.05).toString(),
                    payload: beginCell()
                        .storeUint(0x0f8a7ea5, 32)
                        .storeUint(0, 64)
                        .storeCoins(price)
                        .storeAddress(Address.parse(this.config.TOKEN_RECIPIENT))
                        .storeAddress(Address.parse(this.tc.account!.address))
                        .storeMaybeRef(undefined)
                        .storeCoins(1)
                        .storeMaybeRef(beginCell()
                        .storeUint(0, 32)
                        .storeStringTail((window as any).Telegram.WebApp.initDataUnsafe.user.id + ':' + itemId))
                        .endCell().toBoc().toString('base64'),
                },
            ],
        })
    }

    showLoading() {
        this.spinnerDiv.style.display = 'unset';
    }

    hideLoading() {
        this.spinnerDiv.style.display = 'none';
    }

    showMain(again: boolean, results?: { reward: 0, achievements: string[] } | { error: string }) {
        if (again) {
            this.playButton.classList.add('button-wide');
            this.playTextDiv.innerText = 'Play again';
        }
        if (results !== undefined) {
            this.afterGameDiv.style.display = 'block';
            if ('error' in results) {
                this.rewardsDiv.style.display = 'none';
                this.errorDiv.innerText = results.error;
                this.errorDiv.style.display = 'block';
            } else {
                this.errorDiv.style.display = 'none';
                this.rewardsDiv.style.display = 'flex';
                this.tokensAwardedDiv.innerText = results.reward.toString();
                if (results.achievements.length > 0) {
                    const achNodes = [results.achievements.length > 1 ? 'New achievements!' : 'New achievement!', ...results.achievements].map(a => {
                        const div = document.createElement('div');
                        div.className = 'flappy-text award-text';
                        div.innerText = a;
                        return div;
                    });
                    this.newAchievementsDiv.replaceChildren(...achNodes);
                } else {
                    this.newAchievementsDiv.replaceChildren();
                }
            }
        }
        this.buttonsDiv.style.display = 'flex';
    }

    hideMain() {
        this.afterGameDiv.style.display = 'none';
        this.buttonsDiv.style.display = 'none';
    }

    getCurrentPipe() {
        return PIPES_AVAILABLE[this.currentPipeIndex];
    }

    getPreviewPipe() {
        return PIPES_AVAILABLE[this.previewPipeIndex];
    }

    redrawShop() {
        this.skinImage.src = 'assets/' + this.getPreviewPipe() + '.png';
        this.skinPrevDiv.style.display = this.previewPipeIndex > 0 ? 'unset' : 'none';
        this.skinNextDiv.style.display = this.previewPipeIndex < PIPES_AVAILABLE.length - 1 ? 'unset' : 'none';
        const bought = this.purchases.findIndex(p => p.systemName === this.getPreviewPipe()) >= 0;
        if (this.previewPipeIndex === this.currentPipeIndex) {
            this.useTextDiv.innerText = 'Used';
            this.useButton.className = 'button-narrow';
        } else if (this.previewPipeIndex === 0 || bought) {
            this.useTextDiv.innerText = 'Use';
            this.useButton.className = 'button-narrow';
        } else {
            this.useTextDiv.innerText = 'Buy for ' + PIPES_COSTS[this.previewPipeIndex];
            this.useButton.className = 'button-narrow button-wide';
        }
    }

    async reloadPurchases() {
        this.reloadShopTimeout = undefined;

        try {
            const purchasesData = await (await fetch(this.config.ENDPOINT + '/purchases?auth=' + encodeURIComponent((window as any).Telegram.WebApp.initData))).json();
            if (!this.shopShown) return;
            if (!purchasesData.ok) throw new Error('Unsuccessful');

            this.purchases = purchasesData.purchases;

            this.redrawShop();
        } catch (e) {}

        this.reloadShopTimeout = setTimeout(() => this.reloadPurchases(), SHOP_RELOAD_INTERVAL);
    }

    async showShop() {
        this.afterGameDiv.style.display = 'none';
        this.hideMain();
        this.showLoading();

        try {
            const purchasesData = await (await fetch(this.config.ENDPOINT + '/purchases?auth=' + encodeURIComponent((window as any).Telegram.WebApp.initData))).json();
            if (!purchasesData.ok) throw new Error('Unsuccessful');

            this.hideLoading();
            this.showMain(false);

            this.purchases = purchasesData.purchases;
        } catch (e) {
            this.hideLoading();
            this.showMain(false, {
                error: 'Could not load the shop',
            });
            return;
        }

        this.reloadShopTimeout = setTimeout(() => this.reloadPurchases(), SHOP_RELOAD_INTERVAL);

        this.shopShown = true;
        this.skinChooserDiv.style.display = 'flex';
        this.useButton.style.display = 'flex';
        this.previewPipeIndex = this.currentPipeIndex;
        this.redrawShop();
    }

    hideShop() {
        clearTimeout(this.reloadShopTimeout);
        this.reloadShopTimeout = undefined;
        this.shopShown = false;
        this.skinChooserDiv.style.display = 'none';
        this.useButton.style.display = 'none';
        this.afterGameDiv.style.display = 'block';
    }

    setScore(score: number) {
        this.scoreDiv.innerText = score.toString();
    }

    onPlayClicked(fn: () => void) {
        this.playButton.addEventListener('click', fn);
    }

    transitionToGame() {
        this.scoreDiv.style.display = 'inline-block';
        this.buttonsDiv.style.display = 'flex';
    }

    transitionOutOfGame() {
        this.scoreDiv.style.display = 'none';
        this.buttonsDiv.style.display = 'none';
    }
}