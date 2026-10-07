-- Persist the Stakeholder / Viewer role used by the application.
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'VIEWER';
ALTER TYPE "ProjectRole" ADD VALUE IF NOT EXISTS 'VIEWER';
