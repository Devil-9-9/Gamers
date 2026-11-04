# BLOCK OPS

Minecraft building + Call of Duty shooting, in the browser. Phone first. P2P multiplayer. Installable PWA.

## Run
Static site, no build step. ES modules need a server (not `file://`):

    npx serve .          # or: python3 -m http.server 8080

Deploy: push to GitHub, import into Vercel (Framework: Other, no build command). `vercel.json` is included.
For phone install, open the deployed HTTPS URL, then Add to Home Screen.

## Offline / no-CDN (recommended before shipping)
Libraries load from unpkg at pinned versions (Three r160, cannon-es 0.20, PeerJS 1.5.2) and are cached by the service worker.
To bundle them locally, run once with internet: `bash scripts/vendor.sh`

## Controls
PC: WASD, Shift sprint, Space jump, C crouch, LMB shoot, RMB scope (place in build mode), R reload, 1-4 weapons,
F toggle BUILD/COMBAT, G place, X break, Q/E or wheel = block, 5-9 = block slots.
Phone: left stick move (push past the ring to sprint), drag right side to look, SHOOT / JUMP / RELOAD / SCOPE / BUILD /
PLACE / DUCK / RUN / SWAP / BLOCK buttons. In BUILD mode, SHOOT breaks blocks; PLACE works in any mode.

## Multiplayer
Your permanent ID (`BO-XXXX-1234`) is in the menu with a COPY button. A friend pastes it into JOIN.
The host's ID decides the world seed; the host sends all block edits to late joiners. Shots, block edits and hits sync over WebRTC.
Uses the free public PeerJS signalling server. Strict NAT/corporate networks may need a TURN server.

## Layout
    index.html  manifest.json  service-worker.js  vercel.json
    src/main.js                  menu + boot
    src/core/      Game, Physics (cannon-es), DayNight, Effects, Noise, Constants
    src/blocks/    World (voxel data), ChunkMesher, BlockManager, BuildTool, TextureAtlas, BlockTypes
    src/weapons/   Weapon, AK47, Sniper, Pistol, Shotgun, WeaponManager, Ballistics, ViewModel
    src/player/    Player, VoxelBody, Humanoid
    src/ai/        Bot
    src/controls/  InputState, DesktopControls, MobileControls
    src/multiplayer/ UniqueID, Network, RemotePlayer
    src/ui/        HUD, styles.css
    src/audio/     Audio (synthesised, no audio files)
