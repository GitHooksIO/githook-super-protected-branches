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
                // STEP 2 - revert the pushed commit - woops - caused an infinite loop!!!

                options.url = data.payload.repository.git_commits_url.replace('{/sha}', '');
                options.json = {
                    "tree":  data.payload.before,
                    "message": preventInfiniteLoop
                };

                request.post(options, function protectedBranchReverted(err, httpResponse, body) {

                    if (err) {
                        process.fail('Could not send POST request: ' + err);
                    }
                    else {
                        process.succeed('POST request successful. Result: ' + JSON.stringify(body));


                        /*
                        @TODO - fix.

                        string(169) ""POST request successful. Result: {\"message\":\"Tree SHA is not a tree object\",\"documentation_url\":\"https://developer.github.com/v3/git/commits/#create-a-commit\"}""


                        Need to set options.json.tree to a proper tree SHA. May need to use this:

                        https://developer.github.com/v3/git/trees/#get-a-tree
                         */



                        // STEP 3 - open a Pull Request with the new branch. (could not do this as step 2 because the two branches would be equal, so no PR would be opened)
/*
                        options.url = data.payload.repository.pulls_url.replace('{/number}', '');
                        options.json = {
                            title: data.payload.head_commit.message,
                            body:  'This pull request was automatically generated by the [Super Protected Branches GitHook](http://githooks.io/githooks/GitHooksIO/githook-super-protected-branches) when ' + data.payload.head_commit.author.username + ' tried to push directly to ' + branchToProtect + '.',
                            head:  newBranchName,
                            base:  branchToProtect
                        };

                        request.post(options, function pullRequestOpened(err, httpResponse, body) {
                            if (err) {
                                process.fail('Could not send POST request: ' + err);
                            }
                            else {
                                process.succeed('Pull request creation was successful. Response: ' + JSON.stringify(body));
                            }
                        });
*/
                    }

                });


            }
        });

    }
}