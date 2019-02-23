iCloud Drive Filesystem
===

Mounts iCloud Drive as a FUSE filesystem.

- [x] Mount
- [ ] Read usage/quota
- [x] List zones
- [x] List directory contents
- [x] Read file and directory information
- [ ] Read file contents
- [ ] Write file contents
- [ ] Create directories
- [ ] Rename files and directories

Installation
---

- libfuse/FUSE for macOS/Dokany https://www.npmjs.com/package/fuse-bindings#requirements
    - (macOS) pkg-config
- (Linux) libsecret https://www.npmjs.com/package/keytar#on-linux

### npm

```
npm install -g icloud-drive-fs
```

### Source

```
git clone https://gitlab.fancy.org.uk/samuel/icloud-drive-fs
cd icloud-drive-fs
npx gulp build # or npx gulp watch

node dist/cli.js apple-id --mount /path/to/mount
```

Usage
---

```
icloud-drive-fs apple-id --mount /path/to/mount
```
