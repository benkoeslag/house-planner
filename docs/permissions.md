# Permissions

Status: Draft for repository governance; application permissions are `TBD`.

## Repository authority

| Capability | Human owner | Coding agent | Notes |
| --- | --- | --- | --- |
| Read repository and documentation | Yes | Yes, when authenticated | Least privilege applies |
| Create task branches and commits | Yes | Yes | Never directly on `main` |
| Push feature branches | Yes | Yes | No force-push to protected branches |
| Create/update/review PRs | Yes | Yes | Reviews are advisory |
| Merge PRs to `main` | Yes | No | Final decision belongs to the human owner |
| Change rules, secrets, or access | Yes | No unless explicitly authorized | Administrative operation |

Application capabilities, roles, backend enforcement, account lifecycle, and administrative audit access are `TBD`.
