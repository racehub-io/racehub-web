# Security reports and local access

RaceHub is an open source local application.
The collector API has no user login or multi-user access control.
Its HTTP server listens on loopback by default.

For remote use, place it behind your authenticated reverse proxy or private network.
Keep game UDP ports on your private network.
See the [self-hosting instructions](README.md#configuration-and-self-hosting) for Host, origin, and range request settings.

Recordings can contain driver names and other personal data.
Browser data and collector disk files are separate copies.
Export files that you need before you clear browser data.
Store private recordings outside your Git checkout.

## Report a problem

- Do not put credentials, personal data, private recordings, or exploit details in public issues.
- Use GitHub private vulnerability reporting if this repository enables it.
- If no private route is available, open an issue that asks for a private contact route. Leave out sensitive details.
- Include the affected revision and reproduction steps after a private route is agreed.

Maintenance depends on contributor time.
There is no promised response time or security support period.
