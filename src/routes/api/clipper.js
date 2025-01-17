"use strict";

const noteService = require('../../services/notes');
const dateNoteService = require('../../services/date_notes');
const dateUtils = require('../../services/date_utils');
const imageService = require('../../services/image');
const appInfo = require('../../services/app_info');
const ws = require('../../services/ws.js');
const log = require('../../services/log');
const utils = require('../../services/utils');
const path = require('path');
const Attribute = require('../../entities/attribute');

async function findClippingNote(todayNote, pageUrl) {
    const notes = await todayNote.getDescendantNotesWithLabel('pageUrl', pageUrl);

    for (const note of notes) {
        if (await note.getLabelValue('clipType') === 'clippings') {
            return note;
        }
    }

    return null;
}

async function addClipping(req) {
    const {title, content, pageUrl, images} = req.body;

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    let clippingNote = await findClippingNote(todayNote, pageUrl);

    if (!clippingNote) {
        clippingNote = (await noteService.createNewNote({
            parentNoteId: todayNote.noteId,
            title: title,
            content: ''
        })).note;

        await clippingNote.setLabel('clipType', 'clippings');
        await clippingNote.setLabel('pageUrl', pageUrl);
    }

    const rewrittenContent = await addImagesToNote(images, clippingNote, content);

    await clippingNote.setContent(await clippingNote.getContent() + '<p>' + rewrittenContent + '</p>');

    return {
        noteId: clippingNote.noteId
    };
}

async function createNote(req) {
    const {title, content, pageUrl, images, clipType} = req.body;

    const todayNote = await dateNoteService.getDateNote(dateUtils.localNowDate());

    const {note} = await noteService.createNewNote({
        parentNoteId: todayNote.noteId,
        title,
        content
    });

    await note.setLabel('clipType', clipType);

    if (pageUrl) {
        await note.setLabel('pageUrl', pageUrl);
    }

    const rewrittenContent = await addImagesToNote(images, note, content);

    await note.setContent(rewrittenContent);

    return {
        noteId: note.noteId
    };
}

async function addImagesToNote(images, note, content) {
    let rewrittenContent = content;

    if (images) {
        for (const {src, dataUrl, imageId} of images) {
            const filename = path.basename(src);

            if (!dataUrl.startsWith("data:image")) {
                log.info("Image could not be recognized as data URL:", dataUrl.substr(0, Math.min(100, dataUrl.length)));
                continue;
            }

            const buffer = Buffer.from(dataUrl.split(",")[1], 'base64');

            const {note: imageNote, url} = await imageService.saveImage(note.noteId, buffer, filename, true);

            await new Attribute({
                noteId: note.noteId,
                type: 'relation',
                value: imageNote.noteId,
                name: 'image-link'
            }).save();

            console.log(`Replacing ${imageId} with ${url}`);

            rewrittenContent = rewrittenContent.replace(imageId, url);
        }
    }

    return rewrittenContent;
}

async function openNote(req) {
    if (utils.isElectron()) {
        ws.sendMessageToAllClients({
            type: 'open-note',
            noteId: req.params.noteId
        });

        return {
            result: 'ok'
        };
    }
    else {
        return {
            result: 'open-in-browser'
        }
    }
}

async function handshake() {
    return {
        appName: "trilium",
        protocolVersion: appInfo.clipperProtocolVersion
    }
}

module.exports = {
    createNote,
    addClipping,
    openNote,
    handshake
};