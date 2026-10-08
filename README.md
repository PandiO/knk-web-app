# Knights & Kings web app

The player and staff web app for Knights & Kings (React + TypeScript, Create React App). It talks
to `knk-web-api` over REST.

## Configuration

Settings are read from `REACT_APP_*` environment variables **at build time**: Create React App
inlines them into the bundle, so a change needs a new `npm run build` (or a restart of
`npm start`). Put them in the shell, in `.env.local` (not committed), or in the build command.

| Variable | Default | Purpose |
|---|---|---|
| `REACT_APP_API_BASE_URL` | `http://localhost:5294/api` in development, `/api` in a production build | Base URL of `knk-web-api`. Use `/api` when the API is served on the same origin as the app (the closed-alpha setup). |
| `REACT_APP_MC_SERVER_ADDRESS` | `play.knightsandkings.net` | The Minecraft server address shown on the landing and register pages. |

Example production build for the alpha:

```bash
REACT_APP_API_BASE_URL=/api REACT_APP_MC_SERVER_ADDRESS=play.knightsandkings.net npm run build
```

Both values are resolved in `src/config/appConfig.ts`.

Authentication: the API keeps the refresh token in an HttpOnly cookie scoped to `/api/Auth`, so
the app sends API calls with `credentials: 'include'`. Serve the app and the API from the same
origin in production; in development the API's CORS settings must allow `http://localhost:3000`
with credentials.

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
