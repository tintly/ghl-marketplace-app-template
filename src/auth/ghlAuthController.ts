import { Request, Response } from 'express';
import { GHL } from '../ghl';

export class GHLAuthController {
  private ghl: GHL;

  constructor() {
    this.ghl = new GHL();
  }

  // Decrypt SSO data and extract user context
  async getUserContext(req: Request, res: Response) {
    try {
      const { key } = req.body;
      
      if (!key) {
        return res.status(400).json({
          error: 'SSO key is required'
        });
      }

      const userData = this.ghl.decryptSSOData(key);
      
      // Extract locationId from companyId context
      // In GHL, we use companyId as the locationId for our database
      const locationId = userData.activeLocation || userData.companyId;
      
      const userContext = {
        userId: userData.userId,
        email: userData.email,
        userName: userData.userName,
        role: userData.role,
        type: userData.type,
        companyId: userData.companyId,
        locationId: locationId, // This is what we'll use in our database
        activeLocation: userData.activeLocation
      };

      res.status(200).json({
        success: true,
        user: userContext
      });
    } catch (error) {
      console.error('SSO decryption error:', error);
      res.status(400).json({
        error: 'Failed to decrypt SSO data'
      });
    }
  }

  // Verify user has access to a specific location
  async verifyLocationAccess(req: Request, res: Response) {
    try {
      const { locationId } = req.params;
      const { key } = req.body;
      
      if (!key || !locationId) {
        return res.status(400).json({
          error: 'SSO key and locationId are required'
        });
      }

      const userData = this.ghl.decryptSSOData(key);
      const userLocationId = userData.activeLocation || userData.companyId;
      
      if (userLocationId !== locationId) {
        return res.status(403).json({
          error: 'Access denied to this location'
        });
      }

      res.status(200).json({
        success: true,
        hasAccess: true
      });
    } catch (error) {
      console.error('Location access verification error:', error);
      res.status(400).json({
        error: 'Failed to verify location access'
      });
    }
  }
}