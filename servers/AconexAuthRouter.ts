import { Router, Request, Response } from 'express';

export const aconexAuthRouter = Router();

const ACONEX_BASE_URL = process.env.ACONEX_BASE_URL || 'https://aconex.com';
const CLIENT_ID = process.env.ACONEX_API_KEY || '';
const CLIENT_SECRET = process.env.ACONEX_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.ACONEX_REDIRECT_URI || '';

/**
 * 1. TRIPPED BY USER: Generates login redirection destination
 */
aconexAuthRouter.get('/auth/login', (req: Request, res: Response) => {
  // Aconex regional instances require exact scope alignment mapping
  const authUrl = `${ACONEX_BASE_URL}/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=urn:aconex:identity:user:read%20urn:aconex:document:registry:write`;
  
  res.redirect(authUrl);
});

/**
 * 2. CALLBACK GATEWAY: Exchanges authorization string code parameters for bearer tokens
 */
aconexAuthRouter.get('/auth/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;

    if (!code) {
      res.status(400).json({ error: 'Authorization code absent from server handshake.' });
      return;
    }

    // Prepare token request payload format
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const response = await fetch(`${ACONEX_BASE_URL}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams
    });

    if (!response.ok) {
      throw new Error(`Token transaction failed: ${response.statusText}`);
    }

    const tokenData = await response.json();

    // Contextual Strategy Tip: For M365 production apps, encrypt and save tokenData 
    // (access_token, refresh_token, expires_in) inside Redis or Database storage mapped to user ID.
    res.status(200).json({
      success: true,
      message: "Authorization successful! M365 user session context successfully verified.",
      session: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      }
    });
  } catch (error: any) {
    console.error('[OAuth Verification Exception]:', error.message);
    res.status(500).json({ success: false, error: 'Authorization handshake failed.', details: error.message });
  }
});