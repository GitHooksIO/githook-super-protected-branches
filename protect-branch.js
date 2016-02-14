module.exports = function (data, process) {

    var branchToProtect = data.parameters.branch || 'master';

    if ( data.payload.ref === ('refs/heads/' + branchToProtect) ) {

        // @TODO we need to branch off, open a pull request,
        // switch back to branchToProtect, and revert the pushed commit.

        var apiUrl = data.payload.repository.git_refs_url.replace('{/sha}', ''),
            options = {
                url: apiUrl,
                headers: {
                    'Content-Type':  'application/json',
                    'User-Agent':    'super-protected-branches',
                    'Authorization': 'token ' + data.access_token
                },
                json: {
                    "ref": "refs/heads/" + branchToProtect + "--super-protected--" + Date.now(),
                    "sha": data.payload.after
                }
            };

        request.post(options, function templatePosted(err, httpResponse, body) {
            if (err) {
                process.fail('Could not send POST request: ' + err);
            }
            else {
                process.succeed('Branch creation successful. Response:' + JSON.stringify(body));
            }
        });

    }
    else {
        process.succeed('the commit was to ' + data.payload.ref + ' and thus was not a problem');
    }
}