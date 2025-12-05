import { Request, Response, NextFunction } from 'express';
import { tokenBlacklistStore } from '../../models/tokenStore';

export default async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Add token to blacklist
      await tokenBlacklistStore.add(token);
    }

    res.status(200).json({
      message: 'Successfully logged out',
    });
  } catch (error) {
    next(error);
  }
}
