import fs from 'fs';
import request from 'request';
import fuse from './fuse';

const fs_open = (...args) => new Promise((rs, rj) => fs.open(...args, (err, fd) => err ? rj(err) : rs(fd)));
const fs_read = (...args) => new Promise((rs, rj) => fs.read(...args, (err, bytesRead, buffer) => err ? rj(err) : rs({bytesRead, buffer})));
// const fs_write = (...args) => new Promise((rs, rj) => fs.write(...args, (err, bytesWritten, buffer) => err ? rj(err) : rs({bytesWritten, buffer})));
const fs_close = (...args) => new Promise((rs, rj) => fs.close(...args, err => err ? rj(err) : rs()));
const fs_stat = (...args) => new Promise((rs, rj) => fs.stat(...args, (err, stat) => err ? rj(err) : rs(stat)));

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
        fullpaths: [zone].concat(path.split('/')),
    };
}

function getCacheFilename(item, cache_path) {
    return require('path').resolve(cache_path, 'File.' + item.drivewsid + '.' + (item.extension || 'data'));
}

export default async function mount(icloud, mount_path, cache_path, mount_options) {
    const libraries = await icloud.drive.getAppLibraries();

    const open_files = new Map();
    let next_fd = 1;

    // const cache = new Map();

    let storage_usage;
    let last_updated_usage;

    await fuse.mount(mount_path, {
        async statfs(path) {
            const block_size = 1000000; // 1 MB

            if (!storage_usage || (last_updated_usage < Date.now() - 10000)) {
                storage_usage = await icloud.getStorageUsage();
                last_updated_usage = Date.now();

                console.log('Storage usage', storage_usage);
            }

            const free_storage = storage_usage.total_storage - storage_usage.used_storage;

            const total_blocks = Math.ceil(storage_usage.total_storage / 1000000);
            // const used_blocks = Math.ceil(storage_usage.used_storage / 1000000);
            const free_blocks = Math.ceil(free_storage / 1000000);

            return {
                bsize: block_size, // Block size
                frsize: block_size, // Fragment size
                blocks: total_blocks, // Total blocks
                bfree: free_blocks, // Free blocks
                bavail: free_blocks, // Blocks available to user
                files: 1000000, // Total file nodes
                ffree: 1000000, // Free file nodes
                favail: 1000000,
                fsid: 1000000, // Filesystem ID
                flag: 1000000,
                namemax: 1000000,
            };
        },
        async readdir(path) {
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
            // console.log('Zone/path:', path);

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
        async getattr(path) {
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

            // console.log('getattr(%s)', path);
            path = parsePath(path);
            // console.log('Zone/path:', path);

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

                if (!item) throw fuse.ENOENT;

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
        async open(path, flags) {
            console.log('open(%s, %d)', path, flags);

            const fd = next_fd++;
            console.log('Assigned file descriptor', fd);

            path = parsePath(path);
            console.log('Zone/path:', path);

            const item = await icloud.drive.getItemByPath(...path.fullpaths);

            if (!item instanceof icloud.drive.constructor.File) {
                throw fuse.EISDIR;
            }

            // Download the file
            let stat;
            try {
                stat = await fs_stat(getCacheFilename(item, cache_path));
            } catch (err) {}

            if (!stat || stat.mtime.getTime() <= item.date_modified.getTime()) {
                const download = await item.getDownloadLink();
                const url = download.data_token ? download.data_token.url
                    : download.manifest_token ? download.manifest_token.url
                        : undefined;

                if (!url) throw new Error('No download URL for', path);

                console.log('Downloading', path, 'from', url, download);
                await new Promise((resolve, reject) => {
                    request(url).pipe(fs.createWriteStream(getCacheFilename(item, cache_path)))
                        .on('close', err => err ? reject(err) : resolve());
                });
                console.log('Finished downloading', path, '- returning fd', fd);
            } else {
                console.log('Using cache for', path, '- returning fd', fd);
            }

            open_files.set(fd, item);

            return fd;
        },
        release(path, fd) {
            console.log('release(%s, %d)', path, fd);

            // const item = open_files.get(fd);

            open_files.delete(fd);
        },
        async read(path, fd, buffer, length, position) {
            if (path.substr(0, 7) === '/.info/' && path.substr(-5, 5) === '.info') {
                const item = await icloud.drive.getItemByPath(...path.substr(7, path.length - 7 - 5).split('/'));
                const data = JSON.stringify(item, null, 4) + '\n';
                const selected = data.substr(position, position + length);
                buffer.write(selected);
                return selected.length;
            }

            const item = open_files.get(fd);
            console.log('read(%s, %d, %d, %d)', path, fd, length, position);

            if (!item) {
                const str = 'hello world\n'.slice(position, position + length);
                if (!str) return 0;
                buffer.write(str);
                return str.length;
            }

            const cachefd = await fs_open(getCacheFilename(item, cache_path), 'r');
            const {bytesRead} = await fs_read(cachefd, buffer, /* offset */ 0, /* length */ length, /* position */ position);
            await fs_close(cachefd);

            return bytesRead;
        },
    }, mount_options || [
        'force',
        'noappledouble',
        'volname=' + icloud.ds_info.fullName + '\'s iCloud Drive',
        // 'fsid=' + icloud.ds_info.dsid,
        'fsname=icloud#' + icloud.apple_id,
        'volicon=/System/Library/PreferencePanes/iCloudPref.prefPane/Contents/Resources/iCloud.icns',
    ]);
}
