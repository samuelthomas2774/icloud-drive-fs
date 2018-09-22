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

### npm

```
npm install -g icloud-drive-fs
```

### Source

```
git clone https://gitlab.fancy.org.uk/samuel/icloud-drive-fs
cd icloud-drive-fs
npm link
npx gulp build # or npx gulp watch
```

Usage
---

```
icloud-drive-fs apple-id --mount /path/to/mount
```
