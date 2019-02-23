import fuse from 'fuse-bindings';

/**
 * Promisified wrapper for fuse-bindings.
 */

function wrapHandler(handler, no_code) {
    return async (...args) => {
        const callback = args.pop();

        try {
            const result = await handler.call(undefined, ...args, fuse.context());
            // console.debug('Handler', handler.name, 'returned', result, '- returning', no_code ? [result] : [0, result]);

            if (no_code) callback(result);
            else callback(0, result);
        } catch (err) {
            console.error('Handler', handler.name, 'threw', err, '- returning', err, 'for', args);

            callback(err);
        }
    };
}

export default {
    mount(mount_path, handlers, options) {
        return new Promise((resolve, reject) => {
            const ops = {};

            if (handlers.init) ops.init = wrapHandler(handlers.init);
            if (handlers.access) ops.access = wrapHandler(handlers.access);
            if (handlers.statfs) ops.statfs = wrapHandler(handlers.statfs);
            if (handlers.getattr) ops.getattr = wrapHandler(handlers.getattr);
            if (handlers.fgetattr) ops.fgetattr = wrapHandler(handlers.fgetattr);
            if (handlers.flush) ops.flush = wrapHandler(handlers.flush);
            if (handlers.fsync) ops.fsync = wrapHandler(handlers.fsync);
            if (handlers.fsyncdir) ops.fsyncdir = wrapHandler(handlers.fsyncdir);
            if (handlers.readdir) ops.readdir = wrapHandler(handlers.readdir);
            if (handlers.truncate) ops.truncate = wrapHandler(handlers.truncate);
            if (handlers.ftruncate) ops.ftruncate = wrapHandler(handlers.ftruncate);
            if (handlers.readlink) ops.readlink = wrapHandler(handlers.readlink);
            if (handlers.chown) ops.chown = wrapHandler(handlers.chown);
            if (handlers.chmod) ops.chmod = wrapHandler(handlers.chmod);
            if (handlers.mknod) ops.mknod = wrapHandler(handlers.mknod);
            if (handlers.setxattr) ops.setxattr = wrapHandler(handlers.setxattr);
            if (handlers.getxattr) ops.getxattr = wrapHandler(handlers.getxattr);
            if (handlers.listxattr) ops.listxattr = wrapHandler(handlers.listxattr);
            if (handlers.removexattr) ops.removexattr = wrapHandler(handlers.removexattr);
            if (handlers.open) ops.open = wrapHandler(handlers.open);
            if (handlers.opendir) ops.opendir = wrapHandler(handlers.opendir);
            if (handlers.read) ops.read = wrapHandler(handlers.read, true);
            if (handlers.write) ops.write = wrapHandler(handlers.write, true);
            if (handlers.release) ops.release = wrapHandler(handlers.release);
            if (handlers.releasedir) ops.releasedir = wrapHandler(handlers.releasedir);
            if (handlers.create) ops.create = wrapHandler(handlers.create);
            if (handlers.utimens) ops.utimens = wrapHandler(handlers.utimens);
            if (handlers.unlink) ops.unlink = wrapHandler(handlers.unlink);
            if (handlers.rename) ops.rename = wrapHandler(handlers.rename);
            if (handlers.link) ops.link = wrapHandler(handlers.link);
            if (handlers.symlink) ops.symlink = wrapHandler(handlers.symlink);
            if (handlers.mkdir) ops.mkdir = wrapHandler(handlers.mkdir);
            if (handlers.rmdir) ops.rmdir = wrapHandler(handlers.rmdir);
            if (handlers.destroy) ops.destroy = wrapHandler(handlers.destroy);

            ops.options = options.filter(i => i !== 'display_folder' && i !== 'force');

            if (options.includes('display_folder')) ops.displayFolder = true;
            if (options.includes('force')) ops.force = true;

            fuse.mount(mount_path, ops, err => {
                if (err) reject(err);
                else resolve(mount_path);
            });
        });
    },

    unmount(mount_path) {
        return new Promise((resolve, reject) => {
            fuse.unmount(mount_path, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    // context() {
    //     return fuse.context();
    // }
};

for (const key in fuse) {
    if (key.startsWith('E')) {
        exports.default[key] = fuse[key];
    }
}
