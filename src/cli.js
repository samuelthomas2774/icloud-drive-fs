#!/usr/bin/env node

import path from 'path';
import yargs from 'yargs';
import fuse from './fuse';

import iCloudService from '../../api';
import mount from '..';

// const apple_id = process.argv[2];
const mount_path = yargs.argv.mount || process.platform !== 'win32' ? path.resolve(__dirname, '..', 'mount') : 'M:\\';

(async () => {
    const icloud = new iCloudService('apple-id', 'password');
    await icloud.authenticate();

    await mount(icloud, mount_path);

    console.log('Filesystem mounted at ' + mount_path);

    process.on('SIGINT', async () => {
        try {
            await fuse.unmount(mount_path);
            console.log('Filesystem at ' + mount_path + ' unmounted');
        } catch (err) {
            console.log('Filesystem at ' + mount_path + ' not unmounted', err);
            process.exit(1);
        }
    });
})();
