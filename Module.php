<?php

namespace skylineos\yii\s3manager;

/**
 * portal module definition class
 */
class Module extends \yii\base\Module
{
    /**
     * @inheritdoc
     */
    public $controllerNamespace = 'skylineos\yii\s3manager\controllers';

    /**
     * The module configuration
     */
    public $configuration;

    /**
     * the session key for the s3 bucket
     *
     * @var        string
     */
    public const SESSION_BUCKET_KEY = 'skys3bucket';

    /**
     * The sesion key for the s3 region
     *
     * @var        string
     */
    public const SESSION_REGION_KEY = 'skys3region';

    /**
     * The sesion key for the s3 prefix
     *
     * @var        string
     */
    public const SESSION_PREFIX_KEY = 'skys3prefix';

    /**
     * Access control rules for the module's actions
     * Apps can override these by setting this property in their module config
     * If null (default), intelligent defaults will be used
     *
     * @var array|null
     */
    public $accessRules = null;

    /**
     * @inheritdoc
     */
    public function init()
    {
        parent::init();

        if ($this->configuration === null) {
            \Yii::error('s3manager configuation must be defined in web/config. Refer to README.');
        }

        // custom initialization code goes here
        $this->modules = [];
    }

    /**
     * Gets the access control rules for the module's actions
     * Returns default rules if none were explicitly configured
     *
     * @return array The access control rules
     */
    public function getAccessRules(): array
    {
        if ($this->accessRules !== null) {
            return $this->accessRules;
        }

        // Intelligent defaults: all actions available to authenticated users
        return [
            [
                'allow' => true,
                'actions' => [
                    'index',
                    'upload',
                    'download',
                    'delete',
                    'get-bucket-object',
                    'get-object',
                    'create-folder',
                    'delete-folder',
                ],
                'roles' => ['@'],
            ],
        ];
    }
}
