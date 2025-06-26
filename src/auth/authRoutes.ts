import { Router } from 'express';
import { AuthController } from './authController';

const router = Router();

router.post('/signup', AuthController.signUp);
router.post('/signin', AuthController.signIn);
router.post('/signout', AuthController.signOut);
router.get('/user', AuthController.getUser);

export { router as authRoutes };