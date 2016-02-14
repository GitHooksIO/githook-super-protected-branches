module.exports = function (data, process) {

    var branchToProtect = data.parameters.branch || 'master';

    if ( data.payload.ref === ('refs/heads/' + branchToProtect) ) {
        process.fail('direct push to ' + branchToProtect + ' detected!');
        // @TODO we need to branch off, open a pull request,
        // switch back to branchToProtect, and revert the pushed commit.
    }
    else {
        process.succeed('the commit was to ' + data.payload.ref + ' and thus was not a problem');
    }
}