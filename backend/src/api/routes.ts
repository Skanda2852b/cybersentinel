import { Router } from 'express';
import modulesRouter from '@modules';

const router = Router();

router.use('/v1', modulesRouter);

export default router;