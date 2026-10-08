
var folderObject;
var bucketObject;

/**
 * Once the page is loaded, render the files within the root folder
 */
$(document).ready( function() {
    /**
     * TOOLTIPS
     */
    $('[data-toggle="tooltip"]').tooltip();

    blocker();

    $.get('/s3manager/default/get-bucket-object', function(data) {
        var obj = JSON.parse(data);
        bucketObject = JSON.parse(obj.bucketObject);
        
        // Store S3 config from backend for URL extraction
        window.s3Bucket = obj.s3Bucket || '';
        window.cdnUrl = obj.cdnUrl || '';

        createJsTree(obj.folderObject);

        $('#mm__wrapper').unblock();
    });

    /** Modal Stuff */
    var opener;

    $('.modal').on('show.bs.modal', function(e) {
        opener = document.activeElement;
        
        // Determine if this was opened from TinyMCE or from a regular button
        var fromTinyMCE = window.tinyMCECallback && typeof window.tinyMCECallback === 'function';
        var targetInputId = $(opener).data('target-input');
        var inputField = targetInputId ? $('#' + targetInputId) : null;
        var folderToLoad = '/';
        
        if (fromTinyMCE) {
            // For TinyMCE, just load the root folder
            folderToLoad = '/';
        } else {
            // First, check if we have the folder stored as data attribute
            if (inputField && inputField.data('s3-folder')) {
                folderToLoad = inputField.data('s3-folder');
            } 
            // Otherwise, try to extract folder from the URL in the input field
            else if (inputField && inputField.val()) {
                folderToLoad = extractFolderFromUrl(inputField.val(), window.s3Bucket);
            }
        }
        
        // Load files and auto-select in tree
        loadFilesInFolder(folderToLoad);

        if (folderToLoad !== '/' && folderToLoad !== '') {
            // Normalize the path for jstree node selection
            var normalizedPath = folderToLoad.replace(/^\/+|\/+$/g, '') || '/';

            setTimeout(function() {
                $('#folderTree').jstree(true).deselect_all();
                $('#folderTree').jstree(true).select_node(normalizedPath);
            }, 100);
        }
    });

    /**
     * Populate the input field with the selected file's effective URL and store the folder context
     */
    $(document).on('click', '#insertFile', function(){
        var selectedUrl = $('#selectedFile').val();
        var currentFolder = $('#s3mm-upload-path').val();
        
        // Check if this is a TinyMCE callback or a regular input field
        if (window.tinyMCECallback && typeof window.tinyMCECallback === 'function') {
            // Call the TinyMCE callback with the selected file URL and meta
            try {
                window.tinyMCECallback(selectedUrl, window.tinyMCEMeta);
            } catch(e) {
                // Fallback: Manually insert into TinyMCE editors
                if (typeof tinymce !== 'undefined' && tinymce.activeEditor) {
                    tinymce.activeEditor.insertContent('<img src="' + selectedUrl + '" />');
                }
            }
            // Clear stored references
            window.tinyMCECallback = null;
            window.tinyMCEValue = null;
            window.tinyMCEMeta = null;
        } else {
            // Regular input field (not TinyMCE)
            var targetInputId = $(opener).data('target-input');
            $('#' + targetInputId).val(selectedUrl);
            $('#' + targetInputId).data('s3-folder', currentFolder);  // Store folder on input for next time
            $('#' + targetInputId).trigger('change');
        }
        
        $('#MediaManager').modal('hide');
    });
});

/**
 * Extract folder path from a full S3 URL or relative path
 * Works reliably with:
 * - CDN URLs: https://cdn.auditiva.us/carousel/slide-1.jpg → /carousel/
 * - Endpoint URLs: https://nyc3.digitaloceanspaces.com/auditiva/carousel/file.jpg → /carousel/
 * - Relative paths: products/file.jpg → /products/
 * - Absolute paths: /products/file.jpg → /products/
 * 
 * @param {string} urlString - The URL or path to extract folder from
 * @param {string} bucket - Optional bucket name to strip (e.g., 'auditiva')
 */
function extractFolderFromUrl(urlString, bucket) {
    if (!urlString || urlString.trim() === '') {
        return '/';
    }
    
    var path = urlString.trim();
    
    // Check if it's a full URL (has protocol or //)
    if (/^(https?:)?\/\//.test(path)) {
        // Remove protocol (http://, https://, or //)
        path = path.replace(/^(https?:)?\/\//, '');
        
        // Remove domain (everything up to first /)
        var firstSlash = path.indexOf('/');
        if (firstSlash === -1) {
            return '/';
        }
        path = path.substring(firstSlash + 1);
        
        // Strip bucket name if it's at the start of the path (endpoint-style URLs)
        if (bucket) {
            var bucketRegex = new RegExp('^' + bucket + '(/|$)');
            if (bucketRegex.test(path)) {
                path = path.substring(bucket.length);
            }
        }
    }
    
    // Remove filename (last segment after last /)
    var lastSlash = path.lastIndexOf('/');
    if (lastSlash > 0) {
        path = path.substring(0, lastSlash);
    } else if (lastSlash === 0) {
        // Path is like "/filename" - root folder
        return '/';
    } else {
        // No slash found - single file in root
        return '/';
    }
    
    return '/' + path + '/';
}

/**
 * Load files for a given folder path
 */
function loadFilesInFolder(folderPath) {
    // Normalize the folder path for bucket lookup (remove leading/trailing slashes)
    var normalizedPath = folderPath.replace(/^\/+|\/+$/g, '') || '/';
    
    $('#s3mm-upload-path').val(folderPath);
    $('#s3mm-object-path-display').html(folderPath);
    $('#files').html('');
    
    clearSelectedFile();

    if (bucketObject[normalizedPath]) {
        for (var file in bucketObject[normalizedPath]) {
            var filename = bucketObject[normalizedPath][file].text;
            var object = bucketObject[normalizedPath][file];
            var fileRow = buildFileRow(
                object.icon, 
                filename, 
                object.id, 
                object.modified, 
                convertSize(object.size),
                (object.filetype === 'image'),
                object.id
            );
            $('#files').append(fileRow);
        }
        
        // Add event listeners
        $('.fileRow').off('click').on('click', function(e) {
            // Don't select if clicking on action icons
            if ($(e.target).closest('a').length === 0) {
                const filename = $(this).data('filename');
                const currentPath = $('#s3mm-upload-path').val();
                selectFile(filename, currentPath, $(this));
            }
        });
        
        $('.s3mm-object').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const filename = $(this).closest('tr').data('filename');
            const fileKey = $(this).attr('id');
            
            // Use AJAX to download with error handling
            $.ajax({
                url: '/s3manager/default/download',
                data: { key: fileKey },
                xhrFields: {
                    responseType: 'blob'
                },
                success: function(blob, status, xhr) {
                    // Check if response is actually a blob (file) or JSON error
                    const contentType = xhr.getResponseHeader('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        // Error response
                        try {
                            const error = JSON.parse(blob);
                            Swal.fire({
                                title: 'Download Error',
                                text: error.message || 'An error occurred while downloading the file.',
                                icon: 'error'
                            });
                        } catch(e) {
                            Swal.fire({
                                title: 'Download Error',
                                text: 'An error occurred while downloading the file.',
                                icon: 'error'
                            });
                        }
                        return;
                    }
                    
                    // Success: download the file
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                },
                error: function(xhr, status, error) {
                    let message = 'An error occurred while downloading the file.';
                    
                    if (xhr.status === 404) {
                        message = 'The file you are trying to download has been deleted or moved.';
                    } else if (xhr.status === 403) {
                        message = 'You do not have permission to download this file.';
                    }
                    
                    Swal.fire({
                        title: 'Download Error',
                        text: message,
                        icon: 'error'
                    });
                }
            });
        });
        
        $('.s3mm-delete-object').off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const fileKey = $(this).attr('id');
            
            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {
                if (result.value === true) {
                    // Delete the file from S3
                    $.get('/s3manager/default/delete?key=' + encodeURIComponent(fileKey), function(data) {
                        // Refetch the entire bucket from backend to ensure fresh data
                        $.get('/s3manager/default/get-bucket-object', function(data) {
                            var obj = JSON.parse(data);
                            $('#folderTree').jstree(true).settings.core.data = obj.folderObject;
                            $('#folderTree').jstree(true).refresh();
                            bucketObject = JSON.parse(obj.bucketObject);
                            
                            // Refresh the current folder view with fresh data
                            const currentPath = $('#s3mm-upload-path').val();
                            loadFilesInFolder(currentPath);
                            
                            Swal.fire(
                                'Deleted!',
                                'Your file has been deleted.',
                                'success'
                            );
                        });
                    });
                }
            });
        });
        
        // Ensure table can receive focus for keyboard navigation
        $('#s3mm-object-list').off('click').on('click', function() {
            $(this).focus();
        });
    }
}

function createJsTree(data)
{
    $('#folderTree').jstree({
        'core' : {
            'data' : data,
            'check_callback' : true,
        },
        'plugins' : [
            ['contextmenu']
        ],
        'contextmenu' : {
            'items' : function(node) {
                var items = $.jstree.defaults.contextmenu.items();
                items.ccp = false;
                items.rename = false;

                return items;
            }
        }
    }).bind('rename_node.jstree', function(e, data) {
        blocker();
        $.post('/s3manager/default/create-folder', { 
            name : data.text, 
            parent : data.node.parent,
        }, function( res ) {
            $.get('/s3manager/default/get-bucket-object', function(data) {
                var obj = JSON.parse(data);
                $('#folderTree').jstree(true).settings.core.data = obj.folderObject;
                $('#folderTree').jstree(true).refresh();
                bucketObject = JSON.parse(obj.bucketObject);
                $('#mm__wrapper').unblock();
            }); 
        });

    }).bind('delete_node.jstree', function(e, data) {
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            // @todo: only remove the node if ajax does not return an error rather than reloding the whole thing
            if (result.value === true) {

                $.post('/s3manager/default/delete-folder', { 
                    key : data.node.id,
                }, function(data) {
                    var result = JSON.parse(data);
        
                    if ( result.error == 'folder not empty' )
                    {
                        Swal.fire({
                            title: 'Error!',
                            text: `This folder contains objects and therefore cannot be deleted. Please remove the 
                                objects before deleting the folder.`,
                            icon: 'error',
                        });
        
                        $.get('/s3manager/default/get-bucket-object', function(data) {
                            var obj = JSON.parse(data);
                            $('#folderTree').jstree(true).settings.core.data = obj.folderObject;
                            $('#folderTree').jstree(true).refresh();
                            bucketObject = JSON.parse(obj.bucketObject);
                        });     
                    } else {
                        Swal.fire(
                            'Deleted!',
                            'Your file has been deleted.',
                            'success'
                        );
                    }
                });
            } else {
                $.get('/s3manager/default/get-bucket-object', function(data) {
                    var obj = JSON.parse(data);
                    $('#folderTree').jstree(true).settings.core.data = obj.folderObject;
                    $('#folderTree').jstree(true).refresh();
                    bucketObject = JSON.parse(obj.bucketObject);
                });
            }
          });
    });
    
    // Ensure folder tree can receive focus for keyboard navigation
    $('#folderTree').on('click', function() {
        $(this).focus();
    });
}

var selectedFile = null;
var selectedFilePath = null;

function selectFile(filename, folderPath, $row) {
    // Update UI
    $('#s3mm-object-list tbody tr').removeClass('selected');
    $row.addClass('selected');
    
    selectedFile = filename;
    selectedFilePath = folderPath + (folderPath.endsWith('/') ? '' : '/') + filename;
    
    // Update selected file section
    updateSelectedFileDisplay();
}

function clearSelectedFile() {
    selectedFile = null;
    selectedFilePath = null;
    updateSelectedFileDisplay();
}

function updateSelectedFileDisplay() {
    const $section = $('#selectedFileSection');
    
    if (!selectedFile) {
        $section.html(`<div class="selected-file-content">
                    <p style="margin: 0; font-size: 12px; color: #999;">No file selected</p>
                </div>`);
        $section.addClass('empty');
        $('#selectedFile').val('');
        $('#insertFile').prop('disabled', true);
    } else {
        // Use CDN URL if available, otherwise fall back to S3 bucket format
        let fileUrl = selectedFilePath;
        if (window.cdnUrl) {
            fileUrl = window.cdnUrl + selectedFilePath;
        } else if (window.s3Bucket) {
            fileUrl = `s3://${window.s3Bucket}${selectedFilePath}`;
        }
        
        $section.html(`<div class="selected-file-content">
                    <div class="selected-file-name"><i class="fas fa-file"></i> ${selectedFile}</div>
                    <div class="selected-file-url-wrapper">
                        <a href="#" id="s3mm-copy-selected-url" class="s3mm-copy-url" data-toggle="tooltip" data-placement="top" title="Copy URL">
                            <i class="fas fa-copy"></i>
                        </a>
                        <div class="selected-file-url" id="s3mm-selected-url-display" title="${fileUrl}">${fileUrl}</div>
                    </div>
                </div>`);
        $section.removeClass('empty');
        $('#selectedFile').val(fileUrl);
        $('#insertFile').prop('disabled', false);
        
        // Re-initialize tooltips for the new button
        $('[data-toggle="tooltip"]').tooltip();
    }
}

function blocker()
{
    $('#mm__wrapper').block({ 
        message : `<div class="loader">
            <span class="ball"></span>
            <span class="ball2"></span>
            <ul><li></li><li></li><li></li><li></li><li></li></ul>
        </div>`,
        css : { backgroundColor: 'none', border: 'none' }
    });
}

/**
* DropZone
*/
var uploader = new Dropzone('#s3mm-file-upload-form', { 
    init: function() {
        this.on("success", function(file) {
            // Clear the dropzone and add the new file
            this.removeAllFiles();

            if ($('#s3mm-upload-path').val() == '/') {
                var key = file.name;
            } else {
                var key = `${$('#s3mm-upload-path').val()}/${file.name}`;
            }

            // Add the new item to the existing bucketObject
            $.get('/s3manager/default/get-object?justPath=false&key='+key, function(data) {
                if ( typeof(bucketObject[$('#s3mm-upload-path').val()]) == "undefined" )
                {
                    bucketObject[$('#s3mm-upload-path').val()] = new Array;
                }

                $.get('/s3manager/default/get-bucket-object', function(data) {
                    var obj = JSON.parse(data);
                    $('#folderTree').jstree(true).settings.core.data = obj.folderObject;
                    $('#folderTree').jstree(true).refresh();
                    bucketObject = JSON.parse(obj.bucketObject);
                });     
            });
        });
    }
});
    
/**
 * Select a file
 */
$('#s3mm-object-list').on('click', '.fileRow', function() {
    blocker();
    $('#s3mm-object-list tr').removeClass('table-info');
    $(this).addClass('table-info');

    var key = $(this).find('.s3mm-object').attr('id');
    $.get('/s3manager/default/get-object?key='+key, function(data) {
        var data = JSON.parse(data);
        $('#insertFile').prop('disabled', false);
        $('#selectedFile').val(data.effectiveUrl);
        $('#s3mm-file-url-display').html(data.effectiveUrl);

        $('#mm__wrapper').unblock();
    });
});

/**
 * Copy selected file URL (using modern Clipboard API)
 */
$(document).on('click', '#s3mm-copy-selected-url', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const urlText = $('#s3mm-selected-url-display').text();
    const $btn = $(this);
    const $icon = $btn.find('i');
    const originalTitle = $btn.attr('title');
    
    // Use modern Clipboard API
    navigator.clipboard.writeText(urlText).then(() => {
        // Show feedback: change icon to checkmark
        $icon.removeClass('fa-copy').addClass('fa-check text-success');
        
        // Hide and reset tooltip
        $btn.tooltip('hide');
        $btn.attr('title', 'Copied!');
        
        // Reset after 2 seconds
        setTimeout(() => {
            $icon.removeClass('fa-check text-success').addClass('fa-copy');
            $btn.attr('title', originalTitle);
        }, 2000);
    }).catch(err => {
        // Fallback for browsers that don't support Clipboard API
        console.error('Clipboard API failed:', err);
        Swal.fire({
            title: 'Copy Failed',
            text: 'Unable to copy URL. Please copy manually.',
            icon: 'error',
            timer: 2000
        });
    });
});

/**
 * When a folder in the jstree is selected, get those files and redraw
 */
$('#folderTree').on("changed.jstree", function (e, data) {
    // data.selected is an array; get the first selected node
    if (data.selected.length > 0) {
        var selectedFolder = data.selected[0];
        // Convert node id back to folder path format for consistency
        var folderPath = selectedFolder === '/' ? '/' : '/' + selectedFolder + '/';
        loadFilesInFolder(folderPath);
    }
});

/**
 * Download an s3 object
 */
$('#s3mm-object-list').on('click', '.s3mm-object', function(e, data) {
    var key = $(this).attr('id');

    window.location.assign('/s3manager/default/download?key='+key);
});

/**
 * TinyMCE File Picker Callback
 * Called when user clicks the image/file button in the TinyMCE editor
 * @param {function} callback - Function to call with the selected file URL
 * @param {string} value - Current value in the editor
 * @param {object} meta - Metadata about the file picker (e.g., filetype, fieldname)
 */
function filemanagerTinyMCE(callback, value, meta) {
    // Store the callback, value, and meta for use when the file is selected
    window.tinyMCECallback = callback;
    window.tinyMCEValue = value;
    window.tinyMCEMeta = meta || {};
    
    // Show the media manager modal
    $('#MediaManager').modal('show');
    
    // Enable/disable the insert button initially
    $('#insertFile').prop('disabled', true);
}

function convertSize(filesize)
{
  var size = filesize.split(' ');

  if ( size[1] === 'bytes' )
    var dim = 'B';

  if ( size[1] === 'kibibytes' )
    var dim = 'KB';

  if ( size[1] === 'mebibytes' )
    var dim = 'MB';

  return size[0]+' '+dim;
}

function buildFileRow(icon, filename, id, modified, size, isImage = false, imageKey = null)
{
    let thumbHtml = '';
    // Safely check if it's an image (defensive for cases where filetype isn't set)
    if (isImage && imageKey) {
        thumbHtml = `<img src="/s3manager/default/thumbnail?key=${encodeURIComponent(imageKey)}" alt="${filename}" style="max-height:100px; max-width:150px; object-fit:contain;" class="img-thumbnail" />&nbsp;`;
    }
    
    var filerow = `<tr class="fileRow" data-filename="${filename}">
        <td>
            <a href="#" id="${id}" class="s3mm-object" data-toggle="tooltip" data-placement="top" title="Download">
                <i class="far fa-arrow-alt-circle-down text-info"></i></a>
            <a href="#" id="${id}" class="s3mm-delete-object" data-toggle="tooltip" data-placement="top" title="Delete">
                <i class="far fa-times-circle text-danger"></i>
            </a>
        </td> 
        <td><i class="${icon}"></i> <span class="filename-text">${filename}</span><div>${thumbHtml}</div></td>
        <td>${modified}</td>
        <td class="text-right text-muted">${size}</td>
    </tr>`;

    return filerow;
}

function humanFileSize(bytes, si) {
    var thresh = si ? 1000 : 1024;
    if(Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = si
        ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['KB','MB','GB','TB','PB','EB','ZB','YB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1)+' '+units[u];
}