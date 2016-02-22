module.exports = function (data, process) {

    function checkForFailures(err) {
        if (err) {
            process.fail('Could not send POST request: ' + err);
        }
    }

    var branchToProtect = data.parameters.branch || 'master',
        preventInfiniteLoop = 'githook-super-protected-branches protected you!';

    if ( data.payload.ref !== ('refs/heads/' + branchToProtect) ) {
        process.succeed('the commit was to ' + data.payload.ref + ' and thus was not a problem');
    }
    else if (data.payload.head_commit.message === preventInfiniteLoop ) {
        process.succeed('This was an automated commit made by super-protected-branches, so processing was skipped');
    }
    else {
        // STEP 1 - branch off.
        var newBranchName = branchToProtect + "--super-protected--" + Date.now(),
            options = {
                url: data.payload.repository.git_refs_url.replace('{/sha}', ''),
                headers: {
                    'Content-Type':  'application/json',
                    'User-Agent':    'super-protected-branches',
                    'Authorization': 'token ' + data.access_token
                },
                json: {
                    "ref": "refs/heads/" + newBranchName,
                    "sha": data.payload.after
                }
            };

        request.post(options, function newBranchCreated(err, httpResponse, body) {
            checkForFailures(err);

            // STEP 2 - create new temporary 'master' branch
            var tmpBranch = branchToProtect + "--tmp--" + Date.now();

            options.url = data.payload.repository.git_refs_url.replace('{/sha}', ''),
            options.json = {
                "ref": "refs/heads/" + tmpBranch,
                "sha": data.payload.before
            }
            request.post(options, function newBranchCreated(err, httpResponse, body) {
                checkForFailures(err);

                // STEP 3 - revert the pushed commit on the temporary 'master' branch
                options.url = data.payload.repository.git_refs_url.replace('{/sha}', '/heads/' + tmpBranch),
                options.json = {
                    "force": true,
                    "sha": data.payload.before
                };
                request.patch(options, function forceRollback(err, httpResponse, body) {
                    checkForFailures(err);

                    // STEP 4 - add a new commit message `preventInfiniteLoop` to the `tmpBranch`.
                    // This must be tackled in several steps.

                    // STEP 4.1 - get tree structure of the tmpBranch
                    options.url = data.payload.repository.trees_url.replace('{/sha}', '/' + data.payload.before);
                    options.json = {};
                    request.get(options, function getTreeStructure(err, httpResponse, body) {
                        checkForFailures(err);

                        // STEP 4.2 - post a new tree object, getting a tree SHA back
                        options.url = data.payload.repository.trees_url.replace('{/sha}', '');
                        options.json = {
                            "base_tree": data.payload.before,
                            "tree":      body.tree
                        };
                        request.post(options, function newTreeCreated(err, httpResponse, body) {
                            checkForFailures(err);

                            // STEP 4.3 - create a new commit object with the current commit SHA as the parent and the new tree SHA, getting a commit SHA back
                            options.url = data.payload.repository.git_commits_url.replace('{/sha}', '');
                            options.json = {
                                "tree":    body.sha,
                                "message": preventInfiniteLoop,
                                "parents": [data.payload.before]
                            };
                            request.post(options, function treeAssociatedWithCommit(err, httpResponse, body) {
                                checkForFailures(err);

                                // STEP 5 - point the `branchToProtect` head to the latest commit to `body.sha`
                                // (which contains the 'githook-super-protected-branches saved you!' commit message)
                                options.url = data.payload.repository.git_refs_url.replace('{/sha}', '/heads/' + branchToProtect);
                                options.json = {
                                    "sha": body.sha,
                                    "force": true
                                };

                                request.patch(options, function protectedBranchReverted(err, httpResponse, body) {
                                    checkForFailures(err);

                                    // STEP 6 - open a PR with `newBranchName`
                                    options.url = data.payload.repository.pulls_url.replace('{/number}', '');
                                    options.json = {
                                        title: data.payload.head_commit.message,
                                        body:  'This pull request was automatically generated by the [Super Protected Branches GitHook](http://githooks.io/githooks/GitHooksIO/githook-super-protected-branches) when ' + data.payload.head_commit.author.username + ' tried to push directly to ' + branchToProtect + '.',
                                        head:  newBranchName,
                                        base:  branchToProtect
                                    };
                                    request.post(options, function pullRequestOpened(err, httpResponse, body) {
                                        checkForFailures(err);

                                        process.succeed('Result*** body: ' + JSON.stringify(body) + ' \n options: ' + JSON.stringify(options.json));
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }
}
