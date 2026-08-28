
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

        createJsTree(obj.folderObject);

        $('#mm__wrapper').unblock();
    });  

    /** Modal Stuff */
    var opener;

    $('.modal').on('show.bs.modal', function(e) {
        opener = document.activeElement;
        
        // Get the target input from the button's data attribute
        var targetInputId = $(opener).data('target-input');
        var inputField = targetInputId ? $('#' + targetInputId) : null;
        var folderToLoad = '/';
        
        // First, check if we have the folder stored as data attribute
        if (inputField && inputField.data('s3-folder')) {
            folderToLoad = inputField.data('s3-folder');
        } 
        // Otherwise, try to extract folder from the URL in the input field
        else if (inputField && inputField.val()) {
            folderToLoad = extractFolderFromUrl(inputField.val(), window.s3Bucket);
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
    $('#insertFile').click(function(){
        var targetInputId = $(opener).data('target-input');
        var currentFolder = $('#s3mm-upload-path').val();
        
        $('#' + targetInputId).val($('#selectedFile').val());
        $('#' + targetInputId).data('s3-folder', currentFolder);  // Store folder on input for next time
        $('#' + targetInputId).trigger('change');
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
    $('#s3mm-file-url-display').html(null);
    $('#s3mm-copy-file-uri').addClass('invisible');
    $('#files').html('');

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
        $('#s3mm-copy-file-uri').removeClass('invisible');

        if ( $('#s3mm-copy-file-uri').hasClass('fa-thumbs-up') )
        {
            $('#s3mm-copy-file-uri').removeClass('fa-thumbs-up');
            $('#s3mm-copy-file-uri').addClass('fa-copy');
        }
        $('#mm__wrapper').unblock();
    });
});

/**
 * Copy a File URI
 */
$('#s3mm-copy-file-uri').click( function() {
    var el = document.getElementById('s3mm-file-url-display');
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    $('#s3mm-copy-file-uri').removeClass('fa-copy');
    $('#s3mm-copy-file-uri').addClass('fa-thumbs-up');
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
 * delete an s3 object
 */
$('#s3mm-object-list').on('click', '.s3mm-delete-object', function(e, data) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.value === true) {
            Swal.fire(
                'Deleted!',
                'Your file has been deleted.',
                'success'
            );

            var key = $(this).attr('id');

            $.get('/s3manager/default/delete?key='+key, function(data) {
                $.get('/s3manager/default/get-bucket-object', function(data) {
                    var obj = JSON.parse(data);
                    $('#folderTree').jstree(true).settings.core.data = obj.folderObject;
                    $('#folderTree').jstree(true).refresh();
                    bucketObject = JSON.parse(obj.bucketObject);
                });
            });

            var parenttr = $(this).closest('tr');
            $(parenttr).remove();    
        }
      });
});

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
    
    var filerow = `<tr class="fileRow">
        <td>
            <a href="#" id="${id}" class="s3mm-object" data-toggle="tooltip" data-placement="top" title="Download">
                <i class="far fa-arrow-alt-circle-down text-info"></i></a>
            <a href="#" id="${id}" class="s3mm-delete-object" data-toggle="tooltip" data-placement="top" title="Delete">
                <i class="far fa-times-circle text-danger"></i>
            </a>
        </td> 
        <td><i class="${icon}"></i> ${filename}<div>${thumbHtml}</div></td>
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

function filemanagerTinyMCE(callback, value, meta)
{
    $('#MediaManager').modal('show');
}