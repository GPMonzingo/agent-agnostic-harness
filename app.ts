import express from 'express';
import dotenv from 'dotenv';
import { aconexAuthRouter } from './servers/AconexAuthRouter';
import { aconexGatewayRouter } from './servers/AconexGatewayRouter';

dotenv.config();
const app = express();

app.use(express.json());

// Main Mountpoints
app.use('/api/v1/aconex', aconexAuthRouter);     // Mount login + callback endpoints here
app.use('/api/v1/aconex', aconexGatewayRouter);  // Mount documents fetch/push endpoints here

app.listen(3000, () => console.log('⚡️ Enterprise-ready Authenticated Aconex Gateway Live on port 3000'));