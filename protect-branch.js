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

                            process.succeed('POST request successful. Result: ' + JSON.stringify(body) + '...' + JSON.stringify(options.json));
                        });
                    });
                });
            });
        });
    }
}