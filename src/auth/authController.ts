import { Request, Response } from 'express';
import { supabase } from '../supabase';

export class AuthController {
  static async signUp(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({
          error: error.message
        });
      }

      res.status(201).json({
        message: 'User created successfully',
        user: data.user,
        session: data.session
      });
    } catch (error) {
      console.error('Sign up error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  static async signIn(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({
          error: error.message
        });
      }

      res.status(200).json({
        message: 'Sign in successful',
        user: data.user,
        session: data.session
      });
    } catch (error) {
      console.error('Sign in error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  static async signOut(req: Request, res: Response) {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(400).json({
          error: error.message
        });
      }

      res.status(200).json({
        message: 'Sign out successful'
      });
    } catch (error) {
      console.error('Sign out error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  static async getUser(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'No valid authorization token provided'
        });
      }

      const token = authHeader.substring(7);
      
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error) {
        return res.status(401).json({
          error: error.message
        });
      }

      res.status(200).json({
        user
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
}