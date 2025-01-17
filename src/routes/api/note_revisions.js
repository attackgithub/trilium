"use strict";

const repository = require('../../services/repository');
const noteCacheService = require('../../services/note_cache');
const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const path = require('path');

async function getNoteRevisions(req) {
    return await repository.getEntities(`
        SELECT * FROM note_revisions 
        WHERE noteId = ? AND isErased = 0
        ORDER BY utcDateCreated DESC`, [req.params.noteId]);
}

async function getNoteRevision(req) {
    const noteRevision = await repository.getNoteRevision(req.params.noteRevisionId);

    if (noteRevision.type === 'file') {
        if (noteRevision.isStringNote()) {
            await noteRevision.getContent();

            noteRevision.content = noteRevision.content.substr(0, 10000);
        }
    }
    else {
        await noteRevision.getContent();

        if (noteRevision.content && noteRevision.type === 'image') {
            noteRevision.content = noteRevision.content.toString('base64');
        }
    }

    return noteRevision;
}

/**
 * @param {NoteRevision} noteRevision
 * @return {string}
 */
function getRevisionFilename(noteRevision) {
    let filename = noteRevision.title || "untitled";

    if (noteRevision.type === 'text') {
        filename += '.html';
    } else if (['relation-map', 'search'].includes(noteRevision.type)) {
        filename += '.json';
    }

    const extension = path.extname(filename);
    const date = noteRevision.dateCreated
        .substr(0, 19)
        .replace(' ', '_')
        .replace(/[^0-9_]/g, '');

    if (extension) {
        filename = filename.substr(0, filename.length - extension.length)
            + '-' + date + extension;
    }
    else {
        filename += '-' + date;
    }

    return filename;
}

async function downloadNoteRevision(req, res) {
    const noteRevision = await repository.getNoteRevision(req.params.noteRevisionId);

    if (noteRevision.noteId !== req.params.noteId) {
        return res.status(400).send(`Note revision ${req.params.noteRevisionId} does not belong to note ${req.params.noteId}`);
    }

    if (noteRevision.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return res.status(401).send("Protected session not available");
    }

    const filename = getRevisionFilename(noteRevision);

    res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
    res.setHeader('Content-Type', noteRevision.mime);

    res.send(await noteRevision.getContent());
}

/**
 * @param {NoteRevision} noteRevision
 */
async function eraseOneNoteRevision(noteRevision) {
    noteRevision.isErased = true;
    noteRevision.title = null;
    await noteRevision.setContent(null);
    await noteRevision.save();
}

async function eraseAllNoteRevisions(req) {
    const noteRevisionsToErase = await repository.getEntities(
        'SELECT * FROM note_revisions WHERE isErased = 0 AND noteId = ?',
        [req.params.noteId]);

    for (const noteRevision of noteRevisionsToErase) {
        await eraseOneNoteRevision(noteRevision);
    }
}

async function eraseNoteRevision(req) {
    const noteRevision = await repository.getNoteRevision(req.params.noteRevisionId);

    if (noteRevision && !noteRevision.isErased) {
        await eraseOneNoteRevision(noteRevision);
    }
}

async function getEditedNotesOnDate(req) {
    const date = req.params.date;

    const notes = await repository.getEntities(`
        select distinct notes.*
        from notes
        left join note_revisions using (noteId)
        where substr(notes.dateCreated, 0, 11) = ?
           or substr(notes.dateModified, 0, 11) = ?
           or substr(note_revisions.dateLastEdited, 0, 11) = ?`, [date, date, date]);

    for (const note of notes) {
        const notePath = noteCacheService.getNotePath(note.noteId);

        note.notePath = notePath ? notePath.notePath : null;
    }

    return notes;
}

module.exports = {
    getNoteRevisions,
    getNoteRevision,
    downloadNoteRevision,
    getEditedNotesOnDate,
    eraseAllNoteRevisions,
    eraseNoteRevision
};