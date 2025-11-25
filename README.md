# [AutoplayStopper (MV3)](https://chromewebstore.google.com/detail/autoplaystopper-mv3/gcendpekmacfohmhhkbhejjfbepkkkib)

## Description

Blocks unwanted media autoplay on websites, with per-site permission control.

It is inspired by the original [AutoplayStopper](https://chromewebstore.google.com/detail/AutoplayStopper/ejddcgojdblidajhngkogefpkknnebdh) Chrome Extension. ([Repository of the original extension](https://github.com/kenijo/AutoplayStopperMV2))

## Note

This extension is compatible with all Chromium based browsers such as: Brave, Chrome, Edge, Opera, Vivaldi, etc.

Some browsers such as such as [Brave](https://brave.com), [Edge](https://www.microsoft.com/edge), [Vivaldi](https://vivaldi.com), or [Firefox](https://www.firefox.com) already have proper browser based autoplay blocking support. Just enable the browser's built-in autoplay blocking feature in the settings.

## Roadmap

Focus on improving website handling (such as instagram, tiktok, threads, youtube, etc.)

## Release Notes

Report issues at <https://github.com/kenijo/AutoplayStopperMV3/issues>

Version 2025.11.24

- Change the UI from 2 buttons to 3 way switch to display "default" behavior
- Improve behavior and icon status tracking across tabs and popup/option pages
- Switch from whitelist to permission control (per-site permission: Default, Allow, Block)
- Add option to choose default global behavior (Always Allow, Always Block)
- Improved domain validation
- Rework UI for better readability and consistency
- Update icons to match the status of the extension
- Automatically sync settings across devices
- Update core logic for improved performances
- Add option to enable debug logging

Version 2025.09.26

- Sync the global status button color with the extension status
- Restore previous core blocking code that was mistakenly released and would not work on many websites anymore

Version 2025.09.25

- Change the extension button behavior from turn the extension ON/OFF to showing up a popup menu that allows enabling/disabling the extension, adding the current site to the whitelist, and opening the options page.
- The extension button icon matches the status of the extension (on, off, disabled)

Version 2025.09.24

- Add configuration export/import as JSON
- Cleanup the options page UI

Version 2025.09.17

- Add on option page to whitelist domains.
- Disabled any reference to muting videos to respect the original website intended behavior and to avoid any confusion.

Version 2025.08.20

- Set video mute to false by default so that when a user plays a video, the sound comes on.

Version 2025.08.19

- Provide much stricter blocking of autoplay across all websites (including msn.com and others)

Version 2025.08.18 (2.0)

- Rewrite extension to be stricter and cover a wider range of websites

- Add the ability to turn the extension ON/OFF from the toolbar

Version 2025.08.04 (1.1)

- Initial release

## Enhanced Safe Browsing

If you have Enhanced Safe Browsing enabled, you may see the following error message:

![Proceed with caution](assets/proceed_with_caution.png "Proceed with caution")

![Enhanced Safe Browsing](assets/enhanced_safe_browsing.png "Enhanced Safe Browsing")
