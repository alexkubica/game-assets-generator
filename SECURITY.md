# Security Policy

Report suspected vulnerabilities privately to the repository owner. Do not put
credentials, generated private assets, or deployment details in a public issue.

The xAI keys are server-only. Production access is protected with HTTP Basic
authentication and fails closed when its credentials are missing. Use a unique,
random password over HTTPS and rotate it if it is ever disclosed.
