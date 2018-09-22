#!/usr/bin/env node

import path from 'path';
import readline from 'readline';
import yargs from 'yargs';
import fuse from './fuse';

import iCloudService from '../../api';
import mount from '..';

const apple_id = process.argv[2];
const mount_path = yargs.argv.mount ? path.resolve(process.cwd(), yargs.argv.mount) :
    process.platform !== 'win32' ? path.resolve(__dirname, '..', 'mount') : 'M:\\';

function prompt(message) {
    return new Promise((resolve, reject) => {
        const password_readline = readline.createInterface(process.stdin, process.stdout);
        password_readline.question(message, value => {
            resolve(value);
            password_readline.close();
        });
    });
}

(async () => {
    if (!apple_id) throw new Error('No Apple ID provided.');
    let password;

    try {
        password = await prompt(`Password for ${apple_id}: \u001B[8m`);
    } finally {
        process.stdout.write('\u001B[28m');
    }

    const icloud = new iCloudService(apple_id, password);
    await icloud.authenticate();

    password = null;

    if (icloud.requires_2sa) {
        throw new Error('Account requires two step authentication');
    }

    console.log('Mounting at ' + mount_path);

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
