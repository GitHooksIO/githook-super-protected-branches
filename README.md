# GitHook Super-Protected Branches
Rolls back any commits made directly to a branch of your choice, branching it and making a PR instead.

Caution: this GitHook is in its infancy, so there may be bugs in its implementation, meaning you could lose commit history or even entire files! Use at your own risk.

Requirements:

* counterintuitively, your branch must NOT be marked as a [Protected Branch](https://help.github.com/articles/about-protected-branches/), as the Super Protection mechanism requires the ability to force push to your branch. There is an [open issue](https://github.com/GitHooksIO/githook-super-protected-branches/issues/1) for making this GitHook work with Protected Branches, but this is unlikely to be fixed anytime soon.

Caveats:

* developers can still directly push to your Super Protected Branch if they [use a specific commit message](https://github.com/GitHooksIO/githook-super-protected-branches/issues/4) or if they [merge a branch locally, then push](https://github.com/GitHooksIO/githook-super-protected-branches/issues/5)

Bug fixes and other contributions are welcome and actively encouraged.
