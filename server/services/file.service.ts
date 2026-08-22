import path from 'path';
import fs from 'fs';
import { app, dialog, shell } from 'electron';
import { getDatabasePath, getPrismaClient } from '../database/client';
import { createAuditLog } from './auth.service';

export function getUploadsPath(): string {
  const isDev = process.env.NODE_ENV === 'development';
  const base = isDev
    ? path.join(process.cwd(), 'uploads')
    : path.join(app.getPath('userData'), 'uploads');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

export async function getBackupsPath(): Promise<string> {
  const db = getPrismaClient();
  const settings = await db.schoolSetting.findFirst();

  if (settings?.backupLocation && fs.existsSync(settings.backupLocation)) {
    return settings.backupLocation;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const base = isDev
    ? path.join(process.cwd(), 'backups')
    : path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

export async function saveFile(
  buffer: Buffer,
  filename: string,
  subfolder: string
): Promise<string> {
  const uploadsPath = getUploadsPath();
  const dir = path.join(uploadsPath, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const uniqueName = `${baseName}-${Date.now()}${ext}`;
  const filePath = path.join(dir, uniqueName);

  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export async function deleteFile(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export async function createBackup(customPath?: string): Promise<string> {
  const dbPath = getDatabasePath();
  const backupDir = customPath || await getBackupsPath();
  const date = new Date().toISOString().split('T')[0];
  const backupName = `school-backup-${date}.db`;
  const backupPath = path.join(backupDir, backupName);

  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(dbPath, backupPath);

  await createAuditLog(null, 'BACKUP', 'Database', undefined, `Backup created: ${backupName}`);
  return backupPath;
}

export async function restoreBackup(backupPath: string): Promise<void> {
  const dbPath = getDatabasePath();

  // Create safety backup before restore
  const safetyBackup = await createBackup();
  console.log('Safety backup created:', safetyBackup);

  fs.copyFileSync(backupPath, dbPath);
  await createAuditLog(null, 'RESTORE', 'Database', undefined, `Database restored from: ${backupPath}`);
}

export async function selectBackupFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Select Backup File',
    filters: [{ name: 'Database Backup', extensions: ['db'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
}

export async function selectBackupLocation(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Select Backup Location',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
}

export async function selectFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Select File',
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
}

/**
 * Copies a file from any location into the app's managed uploads folder.
 * Returns the destination path (inside uploads/).
 */
export async function copyFileToUploads(srcPath: string, subfolder: string): Promise<string> {
  const uploadsPath = getUploadsPath();
  const dir = path.join(uploadsPath, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ext = path.extname(srcPath);
  const baseName = path.basename(srcPath, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueName = `${baseName}-${Date.now()}${ext}`;
  const destPath = path.join(dir, uniqueName);

  fs.copyFileSync(srcPath, destPath);
  return destPath;
}

/**
 * Opens a file with the system default application (e.g. Adobe Acrobat, Microsoft Word, Photos)
 */
export async function openFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error('File does not exist on disk.');
  }
  const err = await shell.openPath(filePath);
  if (err) throw new Error(err);
  return 'OK';
}

/**
 * Reads a local file from disk and returns its data URL (base64) so it can be previewed in iframes/img tags.
 */
export async function readFileAsDataUrl(filePath: string): Promise<string> {
  if (filePath.startsWith('data:')) return filePath;
  if (!fs.existsSync(filePath)) throw new Error('File not found on disk.');
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  const mime = mimeTypes[ext] || 'application/octet-stream';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
