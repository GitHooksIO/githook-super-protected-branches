module.exports = function (data, process) {

    function checkForFailures(err) {
        if (err) {
            process.fail('Could not send POST request: ' + err);
        }
    }

    var branchToProtect = data.parameters.branch || 'master',
        preventInfiniteLoop = 'SUPER_PROTECT_REVERT';

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

                        // STEP 4.2 - create an additional commit hash to add to the tree
                        options.url = data.payload.repository.trees_url.replace('{/sha}', '');
                        options.json = {
                            "base_tree": data.payload.before,
                            "tree":    body.tree
                        };
                        request.post(options, function newTreeCreated(err, httpResponse, body) {
                            checkForFailures(err);

                            // STEP 4.3 - associate the commit hash with a commit message
                            options.url = data.payload.repository.git_commits_url.replace('{/sha}', '');
                            options.json = {
                                "tree":    body.sha,
                                "message": preventInfiniteLoop
                            };
                            request.post(options, function treeAssociatedWithCommit(err, httpResponse, body) {
                                checkForFailures(err);

                                // STEP 4.4 - add the commit hash & message to the tmpBranch
                                options.url = data.payload.repository.merges_url;
                                options.json = {
                                    "base": tmpBranch,
                                    "head": body.sha,
                                    "commit_message": preventInfiniteLoop
                                };
                                var preventInfiniteLoopCommit = body.sha;
                                request.post(options, function protectedBranchReverted(err, httpResponse, body) {
                                    checkForFailures(err);

                                    // STEP 5 - replace the 'master' branch with the temporary `tmpBranch`
                                    // (steps 3,4,5 are necessary to prevent infinite loops)
                                    options.url = data.payload.repository.git_refs_url.replace('{/sha}', '') + '/heads/' + branchToProtect;
                                    options.json = {
                                        "sha": preventInfiniteLoopCommit,
                                        "force": true
                                    };
                                    request.patch(options, function protectedBranchReverted(err, httpResponse, body) {

                                        // @TODO - STEP 6 - open a PR with `newBranchName`
                                        process.succeed('Result: ' + JSON.stringify(body) + '...' + JSON.stringify(options.json));
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



            /*
            options.url = data.payload.repository.trees_url.replace('{/sha}', '/' + data.payload.before);
            options.json = {};
            request.get(options, function getTreeStructure(err, httpResponse, body) {
                checkForFailures(err);

                options.url = data.payload.repository.trees_url.replace('{/sha}', '');
                options.json = {
                    "base_tree": data.payload.before,
                    "tree":    body.tree
                };
                request.post(options, function newTreeCreated(err, httpResponse, body) {
                    checkForFailures(err);

                    options.url = data.payload.repository.git_commits_url.replace('{/sha}', '');
                    options.json = {
                        "tree":    body.sha,
                        "message": preventInfiniteLoop
                    };
                    request.post(options, function treeAssociatedWithCommit(err, httpResponse, body) {
                        checkForFailures(err);

                        options.url = data.payload.repository.merges_url;
                        options.json = {
                            "base": branchToProtect,
                            "head": body.sha,
                            "commit_message": preventInfiniteLoop
                        };
                        request.post(options, function protectedBranchReverted(err, httpResponse, body) {
                            checkForFailures(err);


                            // STEP 3 - open a Pull Request with the new branch. (could not do this as step 2 because the two branches would be equal, so no PR would be opened)
                            options.url = data.payload.repository.pulls_url.replace('{/number}', '');
                            options.json = {
                                title: data.payload.head_commit.message,
                                body:  'This pull request was automatically generated by the [Super Protected Branches GitHook](http://githooks.io/githooks/GitHooksIO/githook-super-protected-branches) when ' + data.payload.head_commit.author.username + ' tried to push directly to ' + branchToProtect + '.',
                                head:  newBranchName,
                                base:  branchToProtect
                            };
                            request.post(options, function pullRequestOpened(err, httpResponse, body) {
                                checkForFailures(err);
                                process.succeed('Result: ' + JSON.stringify(body) + '...' + JSON.stringify(options.json));
                            });
                        });
                    });
                });
            });
*/
