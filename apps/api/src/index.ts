import express from 'express';
import { roastCode } from './roastChain.js';

const PORT = 3000;

const app = express();

app.listen(process.env.PORT ?? PORT, () => console.log(`server running on port ${process.env.PORT ?? PORT}`));

app.get('/health', (req, res) => {
    res.send('server is healthy')
})

app.post('/roast/code', express.json(), async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).send('Code is required');
    }

    try {
        const result = await roastCode(code);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error occurred while roasting code');
    }
});