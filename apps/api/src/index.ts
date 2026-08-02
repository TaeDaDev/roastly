import express from 'express';

const PORT = 3000;

const app = express();

app.listen(process.env.PORT ?? PORT, () => console.log(`server running on port ${process.env.PORT ?? PORT}`));

app.get('/health', (req, res) => {
    res.send('server is healthy')
})