# flappy-bird-server

Also see [ARCHITECTURE.md](/ARCHITECTURE.md)

## What's in the box
The example contains:
* Creating jetton - a game currency to reward players.
* Connect a TON wallet. Connect a wallet to earn game coins and win NFTs.
* Rewarding users with NFTs. In the example we reward users for the first and the fifth game.
* Buy game props in the shop.

## Setting up
To run the project locally you need to setup: Telegram bot, [Telegram Mini App](https://core.telegram.org/bots/webapps), Ngrok (proxy), Pinata (IPFS).

### Ngrok
> Ngrok is used to expose your local server to the internet. It's necessary to make your app accessible to Telegram via real domain name with SSL enabled. For example, your `http://localhost:3000` will be available at `https://your-domain.ngrok.io`.

> You can use any other proxy service: [localtunnel](https://theboroer.github.io/localtunnel-www/), [localhost.run](https://localhost.run/), etc. To integrate one to the setup just edit `workspaces/client/expose-localhost.js` file.

Create and setup your [Ngrok account](https://dashboard.ngrok.com/get-started/your-authtoken). After getting your auth token, [create a domain](https://dashboard.ngrok.com/cloud-edge/domains).

### Pinata
> Pinata is decentralized file system used to store your game assets, like achievement badges.

Create and setup your [Pinata account](https://app.pinata.cloud/developers/api-keys). You can select admin privileges for your API key. Save your `API key` and `API secret`. You can not to reveal `API secret` again.

### Telegram bot & Telegram Web App
1. Create a Telegram bot using `/newbot` command of [BotFather](https://t.me/botfather). Save your bot token.
1. Run `/newapp` select your bot to link it with your Telegram Mini App. Enter app name, description, `640x360` px image. Specify domain when the game will be hosted (use domain you got from Ngrok). Then input your game short name for the URL. You will receive full game URL inside of Telegram, e. g.: `https://t.me/flappybirddevbot/flappybirddev` Save it.

### Environment variables
Run `./setup.sh`. Follow the instructions. You are ready to go!
>If you use Windows you can run in from `Git Bash CLI` which comes with `Git` or you can run the project using [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/install).

## Running

To run manually use `npm run dev` command.

To run with Docker use `docker-compose -f ./docker-compose.dev.yaml up` command.
>Ensure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed. Run Docker.

## Connect Wallet implementation

There are two ways to connect a wallet to the game: connect-ui which is implemented as HTML UI and canvas version of the button. Canvas button is in beta, so it supports only Telegram Wallet.

To try both options you can change `CONNECT_UI` variable in `workspaces/client/src/index.ts` file.

## Migrations

* Create a new migration after changing entities `npm run typeorm:generate-migration --name=[NAME]`
* Create an empty migration (for seeding, etc.) `npm run typeorm:create-migration --name=[NAME]`
* Run migrations `npm run typeorm:run-migrations`
