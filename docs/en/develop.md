# Development and Packaging

[← Back to documentation index](../index.md)

For developers. Regular users should start at the [documentation index](../index.md).

## Layout

```text
.
├── src/                  # module sources (mapped to the ZIP root when packing)
│   ├── bin/              # AdGuardHome.yaml and other runtime files
│   ├── scripts/          # tool.sh / iptables.sh / inotify.sh / debug.sh / base.sh
│   ├── webroot/          # module web UI
│   ├── customize.sh      # installer (always keeps config, drops rules before stopping the core)
│   ├── service.sh        # boot service
│   ├── action.sh         # root manager action button
│   ├── uninstall.sh      # uninstaller (stops the core and drops rules before deleting data)
│   ├── settings.conf     # module configuration
│   ├── module.prop       # module metadata
│   └── META-INF/         # installer
├── docs/                 # user documentation (index.md is the entry, zh/ and en/ hold each language)
├── cache/                # packaging cache (git-ignored)
├── output/               # packaging output (created by build.sh)
├── build.sh              # this fork's release script (also downloads FAK-DNS.txt)
├── pack.sh               # upstream's generic packaging script (does not download FAK-DNS)
├── pack.ps1              # currently commented out and unusable
├── version.json          # version and update information
└── changelog.md          # current release notes (also used as the Release body)
```

## Local packaging

This fork's release script is `build.sh`:

```shell
./build.sh
```

It:

1. downloads the FAK-DNS rules to `src/bin/data/FAK-DNS.txt`;
2. downloads the latest AdGuardHome (arm64);
3. packs `output/AdGuardHomeForRoot_arm64.zip`;
4. writes `output/checksums.txt`.

Requires `curl`, `tar` and `zip`. Note that `src/bin/data/FAK-DNS.txt` is a build artifact and is not committed.

`pack.sh` (upstream) can also pack the module, but it does **not** download FAK-DNS.txt; the resulting module's
AGH will fail to start because `upstream_dns_file` is missing. Unless you put FAK-DNS into `src/bin/data/`
yourself, use `build.sh`.

`pack.ps1` is fully commented out and cannot be used; on Windows run `bash build.sh` in WSL / Git Bash.

> Maintenance note: when adding a key to `settings.conf`, add a matching line to the `setting_default`
> list in `scripts/base.sh` so existing installs get the new default automatically.

## CI and releases

This fork's automated release is [`update.yml`](../../.github/workflows/update.yml):

1. every day at 23:00 UTC (07:00 Beijing time) it compares the SHA256 of FAK-DNS;
2. on change (or manual `workflow_dispatch`): `versionCode + 1`, `version=YYYYMMDD`;
3. calls `build.sh`, then commits `.upstream_hash` / `module.prop` / `version.json`;
4. creates a Release such as `20261023_v146` with both zips and `checksums.txt`.

`pack.yml` (upstream) only runs when a `[0-9]*` tag is pushed manually; it requires an 8-digit date tag and calls
`pack.sh` (without FAK-DNS). It is not this fork's release path.

When releasing manually, update:

- `version.json`: increment `versionCode`, set `version` to `YYYYMMDD`
- `src/module.prop`: `version` and `versionCode`
- `changelog.md`: keep only the **current release** changes, one Chinese and one English entry

## Commit style

The repository uses [Conventional Commits](https://www.conventionalcommits.org/). Common prefixes: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`.
