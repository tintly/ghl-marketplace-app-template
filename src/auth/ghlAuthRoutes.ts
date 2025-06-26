import { Router } from 'express';
import { GHLAuthController } from './ghlAuthController';

const router = Router();
const ghlAuthController = new GHLAuthController();

// Get user context from SSO
router.post('/user-context', (req, res) => ghlAuthController.getUserContext(req, res));

// Verify location access
router.post('/verify-location/:locationId', (req, res) => ghlAuthController.verifyLocationAccess(req, res));

export { router as ghlAuthRoutes };