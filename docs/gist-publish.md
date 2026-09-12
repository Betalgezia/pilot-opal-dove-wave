# GitHub Gist publication

Relay can publish the current live subscription directly to a GitHub Gist. No Vercel or edge service is required.

Configure `Gist ID`, `GitHub Token`, and `GitHub Username` under Settings → Publication in the cloud. The token is stored in browser localStorage and is never written to Relay logs.

Relay publishes `relay.b64` and `relay.yaml`, plus `published.at` and `live.count`. The public b64 endpoint is:

`https://gist.githubusercontent.com/{username}/{gistId}/raw/relay.b64`
