# Voice agent configurations

These are the original intake, buyer/renter, professional, what-if and follow-up prompt/tool configurations from the pinned source. Multiple versions are retained because they describe the product’s progression.

The release clears provider-owned agent/voice/tool/workspace identities, replaces original application origins with reserved examples and preserves local workflow graph identities. Treat them as configuration templates: select a version, review its prompt and schemas, commission owned resources, repair provider references and set the recipient’s tool origin before importing.

The current app reads `NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID`, `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` and `NEXT_PUBLIC_ELEVENLABS_PRO_AGENT_ID`; several original roles shared one identity. The ElevenLabs API key is a server-only field. A public agent identifier is visible to the browser, so session authorization and account/provider restrictions belong to the recipient’s implementation.

These templates were parsed and sanitized locally. Voice import, microphone permission, real conversation and tool execution require recipient-owned provider acceptance.
