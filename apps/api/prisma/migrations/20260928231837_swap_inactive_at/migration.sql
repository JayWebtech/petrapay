/*
  Warnings:

  - Added the required column `inactiveAt` to the `Swap` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Swap" ADD COLUMN     "inactiveAt" TIMESTAMP(3) NOT NULL;
