module.exports = function (data, process) {

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
            if (err) {
                process.fail('Could not send POST request: ' + err);
            }
            else {

                options.url = data.payload.repository.trees_url.replace('{/sha}', '/' + data.payload.before);
                options.json = {};

                request.get(options, function getTreeStructure(err, httpResponse, body) {

                    options.url = data.payload.repository.trees_url.replace('{/sha}', '');
                    options.json = {
                        "base_tree": data.payload.before,
                        "tree":    body.tree
                    };

                    request.post(options, function newTreeCreated(err, httpResponse, body) {
                        if (err) {
                            process.fail('Could not send POST request: ' + err);
                        }
                        else {

                            options.url = data.payload.repository.git_commits_url.replace('{/sha}', '');
                            options.json = {
                                "tree":    body.sha,
                                "message": preventInfiniteLoop
                            };

                            var newCommit = body.sha;

                            request.post(options, function treeAssociatedWithCommit(err, httpResponse, body) {
                                if (err) {
                                    process.fail('Could not send POST request: ' + err);
                                }
                                else {

                                    options.url = data.payload.repository.merges_url;
                                    options.json = {
                                        "base": branchToProtect,
                                        "head": newCommit,
                                        "commit_message": preventInfiniteLoop
                                    };

                                    request.post(options, function protectedBranchReverted(err, httpResponse, body) {
                                        if (err) {
                                            process.fail('Could not send POST request: ' + err);
                                        }
                                        else {
                                            process.succeed('POST request successful. Result: ' + JSON.stringify(body) + '...' + JSON.stringify(options.json));
                                        }

                                    });

                                }

                            });
                        }

                    });
                });
            }

        });
    }
}