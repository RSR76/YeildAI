import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();
const adminController = new AdminController();

// Every route here is Admin-only. requireAuth first (populates req.userRole),
// then requireRole('ADMIN') to actually gate it — same two-step pattern as
// your other authenticated routes, just with the extra role check.
router.get('/regions', requireAuth, requireRole('ADMIN'), (req, res) => adminController.listRegions(req, res));
router.get('/regions/:state/:district', requireAuth, requireRole('ADMIN'), (req, res) =>
  adminController.getDistrict(req, res)
);

export default router;
