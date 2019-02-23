#!/usr/bin/env node

import path from 'path';
import readline from 'readline';
import yargs from 'yargs';
import fuse from './fuse';
import keytar from 'keytar';
import _mkdirp from 'mkdirp';

import iCloudService from '@samuelthomas2774/icloud-api';
import mount from '..';

const apple_id = process.argv[2];
const mount_path = yargs.argv.mount ? path.resolve(process.cwd(), yargs.argv.mount) :
    process.platform !== 'win32' ? path.resolve(__dirname, '..', 'mount') : 'M:\\';
const cache_path = yargs.argv.cache ? path.resolve(process.cwd(), yargs.argv.cache) :
    path.resolve(__dirname, '..', 'cache');

function mkdirp(dir, opts) {
    return new Promise((resolve, reject) => {
        _mkdirp(dir, opts, (err, made) => err ? reject(err) : resolve(made));
    });
}

function prompt(message) {
    return new Promise((resolve, reject) => {
        const password_readline = readline.createInterface(process.stdin, process.stdout);
        password_readline.question(message, value => {
            resolve(value);
            password_readline.close();
        });
    });
}

process.on('SIGINT', () => process.stdout.write('\u001B[28m'));

(async () => {
    if (!apple_id) throw new Error('No Apple ID provided.');
    let password;

    try {
        password = await keytar.getPassword('icloud-drive-fs', apple_id);

        if (!password) {
            password = await prompt(`Password for ${apple_id}: \u001B[8m`);
            process.stdout.write('\u001B[28m');

            const save_password = await prompt(`Save password in system keychain (Y/n)? `);

            if (!save_password.match(/n/i)) await keytar.setPassword('icloud-drive-fs', apple_id, password);
        }
    } finally {
        process.stdout.write('\u001B[28m');
    }

    const icloud = new iCloudService(apple_id, password);
    await icloud.authenticate();

    password = null;

    if (icloud.requires_2sa) {
        throw new Error('Account requires two step authentication');
    }

    const created_mount_path = await mkdirp(mount_path);
    if (created_mount_path) console.log('Created ' + created_mount_path);
    console.log('Mounting at ' + mount_path);

    const created_cache_path = await mkdirp(cache_path);
    if (created_cache_path) console.log('Created ' + created_cache_path);
    console.log('Caching at ' + cache_path);

    await mount(icloud, mount_path, cache_path);

    console.log('Filesystem mounted at ' + mount_path);

    if (yargs.argv.user || yargs.argv.group) {
        console.log('Setting user/group to', yargs.argv.user || process.getuid(), yargs.argv.group || process.getgid());

        if (yargs.argv.group) process.setgid(yargs.argv.group);
        if (yargs.argv.user) process.setuid(yargs.argv.user);
    }

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
