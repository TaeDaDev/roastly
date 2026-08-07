import express from 'express';
import { roastCode } from './roastChain.js';

// note: the .js extension here (not .ts) is required by nodenext module
// resolution once you're on ESM - it resolves to the compiled JS at runtime,
// TS just knows to look at the .ts source instead when typechecking

const PORT = 3000;

const app = express();

// stopgap auth until there's real per-user accounts + a DB - one shared
// secret in the env, checked against a header. good enough to stop randoms
// from hitting my Claude bill once this is deployed publicly, but this is
// NOT what the roadmap actually wants long term (per-user API keys, issued
// via /auth/key, persisted in a DB) - revisit once history/persistence exist
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.header('x-roastly-Key');
    if (!authHeader) {
        return res.status(401).send('Authorization header missing');
    } else if (authHeader !== process.env.API_SECRET) {
        return res.status(403).send('Invalid API key');
    } else {
        // have to explicitly call next() here or the request just hangs -
        // forgot this the first time and a valid request would never resolve
        next();
    }
}

app.listen(process.env.PORT ?? PORT, () => console.log(`server running on port ${process.env.PORT ?? PORT}`));

// left open on purpose - no auth needed just to check if the server's alive
app.get('/health', (req, res) => {
    res.send('server is healthy')
})

// requireAuth runs first and either calls next() or ends the request -
// express runs middleware left to right, so express.json() (body parsing)
// only ever happens for requests that already passed the key check
app.post('/roast/code', requireAuth, express.json(), async (req, res) => {
    const { code } = req.body;

    // has to check typeof too, not just truthiness - somebody could send
    // { code: 123 } and a falsy check alone would let that slip through
    // to roastCode(), which expects an actual string
    if (!code || typeof code !== 'string') {
        return res.status(400).send('Code is required');
    }

    try {
        const result = await roastCode(code);
        res.json(result);
    } catch (error) {
        // don't want a bad Claude response or a network hiccup to crash
        // the whole server - catch it, log it, and return a real error
        // status instead of letting it 500 with no explanation
        console.error(error);
        res.status(500).send('Error occurred while roasting code');
    }
});
