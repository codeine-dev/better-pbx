# better-pbx

A PBX in a single Docker image, with a Web UI for configuration. Asterisk as the foundation, with an API to manage the configuration files, and a React-based modern frontend for the admin to use.

Deployment should be as simple as:

`docker run --network=host better-pbx:latest`

## Features

- SIP extensions and trunks
  - ulaw/gsm/g711/g722 codecs
- Outbound routing w/dialplans
- Inbound routing
- IVR
- Voicemail
- Ring Groups

## Design Factors

### Configuration Snapshots

After making any changes, a snapshot should be taken (a Git commit) and an option to rollback to the previous commit should be offered.

### Volume Mounts for Voicemail storage

When deploying the Docker image, a mount should be available for voicemail to be stored: /data/voicemail

### Initial Setup Wizard

The WebUI should force an initial setup wizard, to configure things like regional preferences for voices, tones, dialplans, etc. Sensible defaults should always be offered, and only absolutely mandatory values should be required to be changed.

### Hardened Asterisk

The config should ALWAYS be checked to ensure it's hardened against attack. The Web UI shouldn't let the user make bad choices. Include `fail2ban` for the SIP channels, so that IPs can be rejected/blocked if they fail multiple registrations etc. Also provide a whitelist/blacklist option in the Web UI to allow the user to force either way.
