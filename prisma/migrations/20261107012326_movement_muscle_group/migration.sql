-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'LEGS', 'ABS', 'LOWER_BACK');

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "muscleGroup" "MuscleGroup";
