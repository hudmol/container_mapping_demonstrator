var Utils = {};

Utils.display_string = function (record) {
    if (typeof record == 'object' && record.get_id) {
        return record.get_id();
    } else {
        return record;
    }
}


// Parent of all records
function BaseRecord(properties) {
    var self = this;

    // We'll use this to distinguish stored records from new ones.
    properties['id'] = false;

    this.properties = properties;

    $.each(properties, function (property) {
        self['set_' + property] = function (value) {
            this[property] = value;
            return this;
        }

        self['get_' + property] = function (value) {
            return this[property];
        }
    });


    this.clear_errors = function ($container) {
        $errorsList = $container.find('.errors');
        $errorsList.empty();

        $container.find('.has-error').removeClass('has-error');
        $container.find('.input-updated').removeClass('input-updated');
    };


    this.render = function ($container) {
        this.clear_errors($container);

        var obj_to_render = this;
        $.each(self.properties, function (property) {
            var display_string = Utils.display_string(obj_to_render[property]);
            $('#' + property, $container).val(display_string);

            if (display_string) {
                $('#' + property, $container).addClass('input-updated');
            }

        });

        errors = obj_to_render.validate();

        $.each(errors, function (idx, error) {
            var property = error[0];
            var error_msg = error[1]

            $('#' + property, $container).parent().addClass('has-error');

            $errorsList.append($('<li>').append(property + " - " + error_msg));
        });
    };


    this.validate = function () {
        var obj_to_validate = this;
        var errors = [];
        $.each(self.properties, function (property, required) {
            if (required && obj_to_validate[property] === undefined) {
                errors.push([property, "required but missing"]);
            }
        });

        return errors;
    };


    this.init_from_dom = function ($node) {
        var obj_to_init = this;

        $.each(self.properties, function (property) {
            var value = $node.find('#' + property).val();

            if (value !== undefined && value !== "") {
                obj_to_init[property] = value;
            }
        });
    };


    this.init_from_values = function (values) {
        var obj_to_init = this;

        $.each(values, function (property, value) {
            obj_to_init[property] = value;
        });
    };

    this.init = function (values) {
        if (values instanceof jQuery) {
            this.init_from_dom(values);
        } else {
            this.init_from_values(values || {});
        }
    };

}


// ArchivesSpace container
function ASpaceContainer(values) { this.init(values); }

ASpaceContainer.prototype = new BaseRecord({
    'type_1' : false,
    'indicator_1' : false,
    'barcode_1' : false,
    'type_2' : false,
    'indicator_2' : false,
    'type_3' : false,
    'indicator_3' : false,
    'container_extent' : false,
    'container_extent_type' : false,
    'series' : false,
});



ASpaceContainer.prototype.validate = function() {
    var parent = ASpaceContainer.prototype.validate;

    return function () {
        var errors = parent.call(this);

        if (this.get_barcode_1() || (this.get_indicator_1() && this.get_type_1())) {
            // All OK
        } else {
            var msg = "You must specify a barcode or both of type_1 and indicator_1";
            errors.push(['barcode_1', msg]);
            errors.push(['type_1', msg]);
            errors.push(['indicator_1', msg]);
        }

        return errors;
    }
}();



// Top container
function TopContainer(values) { this.init(values); }
TopContainer.prototype = new BaseRecord({
    'indicator' : true,
    'barcode' : false,
    'ils_holding_id' : false,
    'ils_item_id' : false,
    'exported_to_ils' : false,
    'container_profile' : false,
    'series' : false,
});


// Container Profile
function ContainerProfile(values) { this.init(values); }
ContainerProfile.prototype = new BaseRecord({
    'name' : true,
    'url' : false,
    'dimension_units' : true,
    'extent_dimension' : true,
    'height' : true,
    'width' : true,
    'depth' : true,
});


// Sub Container
function SubContainer(values) { this.init(values); }
SubContainer.prototype = new BaseRecord({
    'top_container' : true,
    'type_2' : false,
    'indicator_2' : false,
    'type_3' : false,
    'indicator_3' : false,
});



// Fake database
function Database() {
    this.top_containers = [];
    this.container_profiles = [];
}

Database.prototype.add_top_container = function (top_container) {
    this.top_containers.push(top_container);
}

Database.prototype.add_container_profile = function (container_profile) {
    this.container_profiles.push(container_profile);
}


Database.prototype.find_top_container_with_barcode = function (barcode) {
    var result = false;

    $.each(this.top_containers, function (idx, top_container) {
        if (top_container.get_barcode() === barcode) {
            result = top_container;
            return false;
        }
    });

    return result;
}


Database.prototype.find_container_profile_with_name = function (name) {
    var result = false;

    $.each(this.container_profiles, function (idx, container_profile) {
        if (container_profile.get_name() === name) {
            result = container_profile;
            return false;
        }
    });

    return result;
}


Database.prototype.find_top_container_by_series_and_indicator = function (series, indicator) {
    var result = false;

    $.each(this.top_containers, function (idx, top_container) {
        if (top_container.get_series() === series && top_container.get_indicator() === indicator) {
            result = top_container;
            return false;
        }
    });

    return result;
}



Database.prototype.render = function ($container) {
    $container.empty();

    this.render_records(TopContainer, this.top_containers, $container);
    this.render_records(ContainerProfile, this.container_profiles, $container);
}

Database.prototype.render_records = function (record_type, records, $container) {
    var columns = record_type.prototype.properties;

    var table = $('<table class="table" />');
    var header_row = $('<tr />');
    $.each(columns, function (property) {
        header_row.append($('<th>').append(property));
    });

    table.append(header_row);

    $.each(records, function (idx, record) {
        var row = $('<tr>');

        $.each(columns, function (property) {
            var cell = $('<td>').append(Utils.display_string(record[property]));
            row.append(cell);
        });

        table.append(row);
    });


    $container.append($('<h3>').append(record_type.name));
    $container.append(table);
}


// Mapping handler

function AspaceToYaleMappingHandler(db, $container, $button) {
    var self = this;

    this.container = $container;
    this.mappings = [];
    this.database = db;

    $button.on('click', function () {
        $('input[type=text]', '#subcontainer_form').val('');
        $('input[type=text]', '#container_profile_form').val('');
        $('input[type=text]', '#top_container_form').val('');


        var subcontainer = self.map_record();

        if (!subcontainer) {
            return false;
        }

        subcontainer.render($('#subcontainer_form'));

        var top_container = subcontainer.get_top_container();

        if (top_container) {
            top_container.render($('#top_container_form'));

            var container_profile = top_container.get_container_profile();

            if (container_profile) {
                container_profile.render($('#container_profile_form'));
            }
        }
    });
}

AspaceToYaleMappingHandler.prototype.map_record = function() {
    var aspace_container = new ASpaceContainer(this.container);

    aspace_container.clear_errors(this.container);

    // Validate it
    if (aspace_container.validate().length > 0) {
        // show errors and abort
        aspace_container.render(this.container);
        return false;
    }

    var subcontainer = new SubContainer();

    this.apply_mappings(aspace_container, subcontainer, this.database);

    return subcontainer;
};


AspaceToYaleMappingHandler.prototype.add_mapping = function(description, fn) {
    this.mappings.push({
        description : description,
        fn : fn
    });
};


AspaceToYaleMappingHandler.prototype.apply_mappings = function(aspace_container, subcontainer, db) {
    $.each(this.mappings, function (idx, mapping) {
        mapping.fn(aspace_container, subcontainer, db);
    });
};


AspaceToYaleMappingHandler.prototype.render_mapping_rules = function($container) {
    $container.empty();

    $.each(this.mappings, function (idx, mapping) {
        $container.append($('<li>').append(mapping.description));
    });

}


// Canned ASpace records for ease-of-testing

function CannedRecords() {
    this.records = []
    this.next_id = 0;
}

CannedRecords.prototype.add = function (description, record) {
    this.records.push({
        description : description,
        record : record
    });

    this.next_id += 1;
};

CannedRecords.prototype.apply = function (idx) {
    this.records[idx].record.render($('#aspace_container'));
};

CannedRecords.prototype.render = function ($container) {
    $container.empty();

    var self = this;

    $.each(this.records, function (idx, item) {
        var $button = $('<button class="btn btn-xs">apply</button>');
        var $item = $('<li>').append($button).append(' ').append(item.description);

        $container.append($item);

        $button.on('click', function () {
            self.apply(idx);
        });
    });
};



canned_records = new CannedRecords();

canned_records.add("Container with existing barcode",
                   new ASpaceContainer({
                       'barcode_1' : '12345'
                   }));

canned_records.add("Container with a new barcode",
                   new ASpaceContainer({
                       'barcode_1' : '1928374',
                       'type_2' : 'Folder',
                       'indicator_2' : '40',
                       'type_3' : 'Reel',
                       'indicator_3' : '2',
                   }));

canned_records.add("Container with a new barcode and a type_1 matching a container profile",
                   new ASpaceContainer({
                       'type_1' : 'folio',
                       'barcode_1' : '1928374',
                       'type_2' : 'Folder',
                       'indicator_2' : '40',
                       'type_3' : 'Reel',
                       'indicator_3' : '2',
                   }));

canned_records.add("Container with a new type_1/indicator_1 matching a container profile",
                   new ASpaceContainer({
                       'type_1' : 'archive_legal',
                       'indicator_1' : '40',
                       'type_2' : 'Folder',
                       'indicator_2' : '94',
                       'type_3' : 'Reel',
                       'indicator_3' : '23',
                   }));

canned_records.add("Container whose indicator_1 matches a top container within the same series",
                   new ASpaceContainer({
                       'series' : 'construction records',
                       'type_1' : 'Box',
                       'indicator_1' : '123',
                       'type_2' : 'Folder',
                       'indicator_2' : '94',
                       'type_3' : 'Reel',
                       'indicator_3' : '23',
                   }));



canned_records.render($('#canned_record_list'));


var db = new Database();

// Sample container profiles

db.add_container_profile(new ContainerProfile({
    id : 'folio',
    name : 'folio',
    'width' : '24215',
    'height' : '1549',
    'depth' : '29286',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'flat_grey12x15x3',
    name : 'flat_grey12x15x3',
    'width' : '4275',
    'height' : '7611',
    'depth' : '14798',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'half_archive_legal',
    name : 'half_archive_legal',
    'width' : '7615',
    'height' : '32473',
    'depth' : '20984',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'archive_legal',
    name : 'archive_legal',
    'width' : '31883',
    'height' : '5913',
    'depth' : '17370',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'archive_letter',
    name : 'archive_letter',
    'width' : '6264',
    'height' : '3868',
    'depth' : '7038',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'half_archive_letter',
    name : 'half_archive_letter',
    'width' : '27016',
    'height' : '26217',
    'depth' : '27931',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'envelope',
    name : 'envelope',
    'width' : '19872',
    'height' : '13527',
    'depth' : '20802',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'flat_grey16x20x1',
    name : 'flat_grey16x20x1',
    'width' : '30588',
    'height' : '32496',
    'depth' : '14056',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'small_archive',
    name : 'small_archive',
    'width' : '28982',
    'height' : '2707',
    'depth' : '20294',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));

db.add_container_profile(new ContainerProfile({
    id : 'microfilm',
    name : 'microfilm',
    'width' : '27960',
    'height' : '5187',
    'depth' : '12765',
    'dimension_units' : 'feet',
    'extent_dimension' : 'width',
}));



// Sample top containers

db.add_top_container(new TopContainer({
    id : 'EXISTING TOP CONTAINER 1',
    barcode : '12345',
    indicator : '123',
    container_profile : db.find_container_profile_with_name('archive_legal'),
    series : 'construction records'
}));

db.add_top_container(new TopContainer({
    id : 'EXISTING TOP CONTAINER 2',
    barcode : '987',
    indicator : '5',
    container_profile : db.find_container_profile_with_name('folio'),
    series : 'vinyl records'
}));



db.render($('#database'));

var handler = new AspaceToYaleMappingHandler(db, $('#aspace_container'), $('#map_record'));


// Mapping definitions


handler.add_mapping("If the barcode_1 is set and matches an existing top container's barcode, link to that top_container.  Otherwise, create a new top container and use that.  If indicator_1 is missing, assume a value of '1' when creating the top container.",
                    function (aspace_container, subcontainer, db) {
                        var barcode = aspace_container.get_barcode_1();

                        if (!barcode) {
                            return subcontainer;
                        }

                        if (db.find_top_container_with_barcode(barcode)) {
                            subcontainer.set_top_container(db.find_top_container_with_barcode(barcode));
                        } else {
                            var indicator = aspace_container.get_indicator_1();

                            if (indicator === undefined) {
                                indicator = "1";
                            }

                            subcontainer.set_top_container(new TopContainer({
                                barcode : aspace_container.get_barcode_1(),
                                indicator : indicator
                            }));
                        }
                    });


handler.add_mapping("If no barcode is present, find a top container whose indicator matches indicator_1 that is linked to the same series.  Failing that, create a new top container.",
                    function (aspace_container, subcontainer, db) {
                        var barcode = aspace_container.get_barcode_1();
                        var series = aspace_container.get_series();
                        var indicator_1 = aspace_container.get_indicator_1();
                        var type_1 = aspace_container.get_type_1();
                        var series = aspace_container.get_series();

                        if (barcode) {
                            // Nothing to do if we have a barcode
                            return subcontainer;
                        }

                        var top_container = db.find_top_container_by_series_and_indicator(series, indicator_1);

                        if (top_container) {
                            // Use existing
                            subcontainer.set_top_container(top_container);
                        } else {
                            // Create a new one
                            subcontainer.set_top_container(new TopContainer({
                                indicator : indicator_1
                            }));
                        }
                    });


handler.add_mapping("Map type_2/indicator_2/type_3/indicator_3 from ArchivesSpace container to subcontainer",
                    function (aspace_container, subcontainer, db) {
                        subcontainer.set_type_2(aspace_container.get_type_2());
                        subcontainer.set_indicator_2(aspace_container.get_indicator_2());
                        subcontainer.set_type_3(aspace_container.get_type_3());
                        subcontainer.set_indicator_3(aspace_container.get_indicator_3());

                        return subcontainer;
                    });


handler.add_mapping("When we create a new top container, if type_1 matches the name of a container profile, link to that container profile",
                    function (aspace_container, subcontainer, db) {
                        var top_container = subcontainer.get_top_container();

                        if (!top_container) {
                            // Nothing to do
                            return subcontainer;
                        }

                        var container_profile = top_container.get_container_profile();

                        if (container_profile) {
                            // Already have one!
                            return subcontainer;
                        }

                        if (top_container.get_id()) {
                            // A pre-existing top container.  Leave it alone.
                            return subcontainer;
                        }

                        if (db.find_container_profile_with_name(aspace_container.get_type_1())) {
                            top_container.set_container_profile(db.find_container_profile_with_name(aspace_container.get_type_1()));
                        }


                        return subcontainer;
                    });



handler.render_mapping_rules($('#mapping_rules'));


$(function () {
    $('#series').val('series_' + Math.floor(Math.random() * 1000000));

    // Disable the generated text fields
    $('.yale_panel input[type=text]').focus(function() {
        this.blur();
    });

});
