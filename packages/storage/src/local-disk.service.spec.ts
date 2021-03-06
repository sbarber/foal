// std
import { strictEqual } from 'assert';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

// 3p
import { ConfigNotFoundError, createService } from '@foal/core';

// FoalTS
import { FileDoesNotExist } from './abstract-disk.service';
import { LocalDisk } from './local-disk.service';

function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function rmDirAndFilesIfExist(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const files = readdirSync(path);
  for (const file of files) {
    const stats = statSync(join(path, file));

    if (stats.isDirectory()) {
      rmDirAndFilesIfExist(join(path, file));
    } else {
      unlinkSync(join(path, file));
    }
  }

  rmdirSync(path);
}

describe('LocalDisk', () => {

  let disk: LocalDisk;

  beforeEach(() => {
    process.env.SETTINGS_DISK_LOCAL_DIRECTORY = 'uploaded';
    if (!existsSync('uploaded')) {
      mkdirSync('uploaded');
    }
    if (!existsSync('uploaded/foo')) {
      mkdirSync('uploaded/foo');
    }

    disk = createService(LocalDisk);
  });

  afterEach(() => {
    delete process.env.SETTINGS_DISK_LOCAL_DIRECTORY;
    rmDirAndFilesIfExist('uploaded');
  });

  describe('has a "write" method that', () => {

    it('should throw an ConfigNotFoundError if no directory is specified in the config.', async () => {
      delete process.env.SETTINGS_DISK_LOCAL_DIRECTORY;
      try {
        await disk.write('foo', Buffer.from('hello', 'utf8'));
        throw new Error('An error should have been thrown.');
      } catch (error) {
        if (!(error instanceof ConfigNotFoundError)) {
          throw new Error('A ConfigNotFoundError should have been thrown');
        }
        strictEqual(error.key, 'settings.disk.local.directory');
        strictEqual(error.msg, 'You must provide a directory name when using local file storage (LocalDisk).');
      }
    });

    it('should write the file at the given path (buffer) (name given).', async () => {
      strictEqual(existsSync('uploaded/foo/test.txt'), false);

      await disk.write('foo', Buffer.from('hello', 'utf8'), { name: 'test.txt' });
      strictEqual(existsSync('uploaded/foo/test.txt'), true);
      strictEqual(readFileSync('uploaded/foo/test.txt', 'utf8'), 'hello');
    });

    it('should write the file at the given path (stream) (name given).', async () => {
      strictEqual(existsSync('uploaded/foo/test.txt'), false);

      const stream = new Readable();
      stream.push(Buffer.from('hello', 'utf8'));
      stream.push(null);
      await disk.write('foo', stream, { name: 'test.txt' });
      strictEqual(existsSync('uploaded/foo/test.txt'), true);
      strictEqual(readFileSync('uploaded/foo/test.txt', 'utf8'), 'hello');
    });

    it('should return the path of the file (name given).', async () => {
      const { path } = await disk.write('foo', Buffer.from('hello', 'utf8'), { name: 'test.txt' });
      strictEqual(path, 'foo/test.txt');
    });

    it('should return the path of the file (name generated with no extension).', async () => {
      const { path } = await disk.write('foo', Buffer.from('hello', 'utf8'));
      strictEqual(path.startsWith('foo/'), true);
    });

    it('should return the path of the file (name generated with the extension "txt").', async () => {
      const { path } = await disk.write('foo', Buffer.from('hello', 'utf8'), {
        extension: 'txt'
      });
      strictEqual(path.startsWith('foo/'), true);
      strictEqual(path.endsWith('.txt'), true);
    });

  });

  describe('has a "read" method that', () => {

    it('should throw an ConfigNotFoundError if no directory is specified in the config.', async () => {
      delete process.env.SETTINGS_DISK_LOCAL_DIRECTORY;
      try {
        await disk.read('foo', 'buffer');
        throw new Error('An error should have been thrown.');
      } catch (error) {
        if (!(error instanceof ConfigNotFoundError)) {
          throw new Error('A ConfigNotFoundError should have been thrown');
        }
        strictEqual(error.key, 'settings.disk.local.directory');
        strictEqual(error.msg, 'You must provide a directory name when using local file storage (LocalDisk).');
      }
    });

    it('should read the file at the given path (buffer).', async () => {
      writeFileSync('uploaded/foo/test.txt', 'hello', 'utf8');
      strictEqual(existsSync('uploaded/foo/test.txt'), true);

      const { file } = await disk.read('foo/test.txt', 'buffer');
      strictEqual(file.toString('utf8'), 'hello');
    });

    it('should read the file at the given path (stream).', async () => {
      writeFileSync('uploaded/foo/test.txt', 'hello', 'utf8');
      strictEqual(existsSync('uploaded/foo/test.txt'), true);

      const { file } = await disk.read('foo/test.txt', 'stream');
      const buffer = await streamToBuffer(file);
      strictEqual(buffer.toString('utf8'), 'hello');
    });

    it('should throw a FileDoesNotExist if there is no file at the given path (buffer).', async () => {
      try {
        await disk.read('foo/test.txt', 'buffer');
        throw new Error('An error should have been thrown.');
      } catch (error) {
        if (!(error instanceof FileDoesNotExist)) {
          throw new Error('The method should have thrown a FileDoesNotExist error.');
        }
        strictEqual(error.filename, 'foo/test.txt');
      }
    });

    it('should throw a FileDoesNotExist if there is no file at the given path (stream).', async () => {
      try {
        await disk.read('foo/test.txt', 'stream');
        throw new Error('An error should have been thrown.');
      } catch (error) {
        if (!(error instanceof FileDoesNotExist)) {
          throw new Error('The method should have thrown a FileDoesNotExist error.');
        }
        strictEqual(error.filename, 'foo/test.txt');
      }
    });

    it('should return the file size (buffer).', async () => {
      writeFileSync('uploaded/foo/test.txt', 'hello', 'utf8');
      strictEqual(existsSync('uploaded/foo/test.txt'), true);

      const { size } = await disk.read('foo/test.txt', 'buffer');
      strictEqual(size, 5);
    });

    it('should return the file size (stream).', async () => {
      writeFileSync('uploaded/foo/test.txt', 'hello', 'utf8');
      strictEqual(existsSync('uploaded/foo/test.txt'), true);

      const { size } = await disk.read('foo/test.txt', 'stream');
      strictEqual(size, 5);
    });

  });

  describe('has a "delete" method that', () => {

    it('should throw an ConfigNotFoundError if no directory is specified in the config.', async () => {
      delete process.env.SETTINGS_DISK_LOCAL_DIRECTORY;
      try {
        await disk.delete('foo');
        throw new Error('An error should have been thrown.');
      } catch (error) {
        if (!(error instanceof ConfigNotFoundError)) {
          throw new Error('A ConfigNotFoundError should have been thrown');
        }
        strictEqual(error.key, 'settings.disk.local.directory');
        strictEqual(error.msg, 'You must provide a directory name when using local file storage (LocalDisk).');
      }
    });

    it('should delete the file at the given path.', async () => {
      writeFileSync('uploaded/foo/test.txt', 'hello', 'utf8');
      strictEqual(existsSync('uploaded/foo/test.txt'), true);

      await disk.delete('foo/test.txt');
      strictEqual(existsSync('uploaded/foo/test.txt'), false);
    });

    it('should throw a FileDoesNotExist if there is no file at the given path.', async () => {
      try {
        await disk.delete('foo/test.txt');
        throw new Error('An error should have been thrown.');
      } catch (error) {
        if (!(error instanceof FileDoesNotExist)) {
          throw new Error('The method should have thrown a FileDoesNotExist error.');
        }
        strictEqual(error.filename, 'foo/test.txt');
      }
    });

  });

});
