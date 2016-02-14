module.exports = function (data, process) {

    // @TODO - get data.parameters.branch. If null, default to 'master'
    //
    // Listen for the 'push' event:
    // https://developer.github.com/v3/activity/events/types/#pushevent
    //
    // If the push was a standard push (i.e. commits, not tags), check the branch.
    // If the branch was data.parameters.branch, we need to branch off, open a pull request,
    // switch back to data.parameters.branch, and revert the pushed commit.


    process.succeed();
}