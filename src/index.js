import fuse from './fuse';

function parsePath(path) {
    // What?
    if (path.substr(0, 1) !== '/') path = '/';

    path = path.substr(1);

    if (path === '') {
        return {
            fullpaths: [],
        };
    }

    if (path.indexOf('/') <= -1) {
        let zone = path;
        if (zone === 'iCloud Drive') zone = 'com.apple.CloudDocs';

        return {
            zone,
            paths: [],
            fullpaths: [zone],
        };
    }

    let zone = path.substr(0, path.indexOf('/'));
    if (zone === 'iCloud Drive') zone = 'com.apple.CloudDocs';

    path = path.substr(path.indexOf('/') + 1);

    return {
        zone,
        path,
        paths: path.split('/'),
        fullpaths: [zone].concat(path),
    };
}

export default async function mount(icloud, mount_path, mount_options) {
    const libraries = await icloud.drive.getAppLibraries();

    // const cache = new Map();

    await fuse.mount(mount_path, {
        async readdir(path, cb) {
            if (path === '/.info' || path.substr(0, 7) === '/.info/') {
                path = parsePath(path.substr(6));

                // List zones
                if (!path.zone) {
                    const items = libraries.map(l => l.zone).concat(['com.apple.CloudDocs']);

                    return items.concat(items.map(item => item + '.info'));
                }

                const item = await icloud.drive.getItemByPath(...path.fullpaths);
                const items = await item.items;

                return items.map(item => item.name + '.info').concat(
                    items.filter(item => item instanceof icloud.drive.constructor.Directory).map(item => item.name));
            }

            console.log('readdir(%s)', path);
            path = parsePath(path);
            console.log('Zone/path:', path);

            // List zones
            if (!path.zone) {
                // return cb(0, libraries.concat(['com.apple.CloudDocs']));
                return libraries.map(l => l.zone).concat(['com.apple.CloudDocs']);
            }

            try {
                const item = await icloud.drive.getItemByPath(...path.fullpaths);

                return await item.dir();
            } catch (err) {
                throw fuse.ENOENT;
            }
        },
        async getattr(path, cb) {
            if (path === '/.info' || path.substr(0, 7) === '/.info/' && path.substr(-5, 5) !== '.info') {
                return {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: 100,
                    mode: 16877,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0,
                };
            }

            if (path.substr(0, 7) === '/.info/' && path.substr(-5, 5) === '.info') {
                const item = await icloud.drive.getItemByPath(...path.substr(7, path.length - 7 - 5).split('/'));
                const data = JSON.stringify(item, null, 4) + '\n';

                return {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: data.length,
                    mode: 33188,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0,
                };
            }

            console.log('getattr(%s)', path);
            path = parsePath(path);
            console.log('Zone/path:', path);

            if (path.zone && path.zone !== 'com.apple.CloudDocs' && !libraries.find(l => l.zone === path.zone)) {
                throw fuse.ENOENT;
            }

            if (!path.zone || !path.path) {
                return {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: 100,
                    mode: 16877,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0,
                };
            }

            try {
                const item = await icloud.drive.getItemByPath(...path.fullpaths);

                return {
                    mtime: item.date_modified,
                    atime: item.date_accessed,
                    ctime: new Date(),
                    nlink: 1,
                    size: item instanceof icloud.drive.constructor.File ? item.size : 100,
                    mode: item instanceof icloud.drive.constructor.File ? 33188 :
                        item instanceof icloud.drive.constructor.Directory ? 16877 : 0,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0,
                };
            } catch (err) {
                throw fuse.ENOENT;
            }

            if (path === '/test') {
                return {
                    mtime: new Date(),
                    atime: new Date(),
                    ctime: new Date(),
                    nlink: 1,
                    size: 12,
                    mode: 33188,
                    uid: process.getuid ? process.getuid() : 0,
                    gid: process.getgid ? process.getgid() : 0,
                };
            }

            throw fuse.ENOENT;
        },
        open(path, flags, cb) {
            console.log('open(%s, %d)', path, flags);
            return 42;
        },
        async read(path, fd, buffer, length, position, cb) {
            if (path.substr(0, 7) === '/.info/' && path.substr(-5, 5) === '.info') {
                const item = await icloud.drive.getItemByPath(...path.substr(7, path.length - 7 - 5).split('/'));
                const data = JSON.stringify(item, null, 4) + '\n';
                const selected = data.substr(position, position + length);
                buffer.write(selected);
                return selected.length;
            }

            console.log('read(%s, %d, %d, %d)', path, fd, length, position);
            const str = 'hello world\n'.slice(position, position + length);
            if (!str) return 0;
            buffer.write(str);
            return str.length;
        },
    }, mount_options || [
        'force',
        'noappledouble',
        'volname=iCloud Drive',
        'fsname=icloud#' + icloud.apple_id,
    ]);
}
